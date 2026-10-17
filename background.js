const AGENTS = [
  {
    id: "immoscout",
    name: "ImmoScout24",
    subagent: "immoscout-search",
    defaultUrl: "https://www.immoscout24.de/Suche/de/hessen/frankfurt-am-main/wohnung-mieten",
    waitSelector: "div[data-obid]",
    scrape: "immoscout",
    hosts: ["immoscout24.de", "immobilienscout24.de"],
    hint: "Oeffnet die Frankfurter Miet-Suche und liest jedes div[data-obid].",
  },
  {
    id: "kleinanzeigen",
    name: "Kleinanzeigen",
    subagent: "kleinanzeigen-search",
    defaultUrl: "https://www.kleinanzeigen.de/s-wohnung-mieten/frankfurt-am-main/c203l4292",
    waitSelector: "#srchrslt-adtable > li",
    scrape: "kleinanzeigen",
    hosts: ["kleinanzeigen.de"],
    hint: "Oeffnet die Frankfurter Miet-Suche und liest die li in #srchrslt-adtable. Kein zweites tabs.update waehrend des Redirects.",
  },
];

let queueRunning = false;

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("main.html");
  const open = await chrome.tabs.query({ url });
  if (open[0]) {
    await chrome.tabs.update(open[0].id, { active: true });
    return;
  }
  await chrome.tabs.create({ url });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "GET_AGENTS") sendResponse({ agents: AGENTS });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "run") return;
  let cancelled = false;
  port.onDisconnect.addListener(() => {
    cancelled = true;
  });
  port.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "RUN_QUEUE") return;
    runQueue(msg, port, () => cancelled).catch((err) => {
      post(port, {
        type: "done",
        ok: false,
        rows: [],
        log: [],
        error: String(err && err.message ? err.message : err),
      });
    });
  });
});

function post(port, payload) {
  try {
    port.postMessage(payload);
  } catch (e) {
    // Control page closed.
  }
}

function agentById(id) {
  return AGENTS.find((a) => a.id === id) || null;
}

function pageUrl(agent, base, page) {
  const u = new URL(base);
  if (agent.id === "immoscout") {
    if (page <= 1) u.searchParams.delete("pagenumber");
    else u.searchParams.set("pagenumber", String(page));
    return u.href;
  }
  let path = u.pathname.replace(/\/seite:\d+(?=\/|$)/, "").replace(/\/$/, "");
  if (page > 1) {
    const cat = path.match(/^(.*?)(\/c\d+l\d+[^/]*)$/);
    path = cat ? cat[1] + "/seite:" + page + cat[2] : path + "/seite:" + page;
  }
  u.pathname = path;
  return u.href;
}

function siblingIs24(url) {
  const u = new URL(url);
  if (/(^|\.)immoscout24\.de$/.test(u.hostname) && !u.hostname.includes("immobilienscout24")) {
    u.hostname = "www.immobilienscout24.de";
    return u.href;
  }
  if (u.hostname.includes("immobilienscout24.de")) {
    u.hostname = "www.immoscout24.de";
    return u.href;
  }
  return "";
}

function pathOf(url) {
  const u = new URL(url);
  return u.origin + u.pathname.replace(/\/$/, "");
}

function sameDocument(a, b) {
  try {
    return pathOf(a) === pathOf(b);
  } catch (e) {
    return false;
  }
}

function waitForComplete(tabId) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };
    const timer = setTimeout(finish, 30000);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab || tab.status === "complete") finish();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureTab(url) {
  const tabs = await chrome.tabs.query({});
  const hit = tabs.find((t) => t.url && sameDocument(t.url, url));
  if (hit) {
    await chrome.tabs.update(hit.id, { active: true });
    return { tabId: hit.id, created: false };
  }
  const tab = await chrome.tabs.create({ url, active: true });
  return { tabId: tab.id, created: true };
}

async function navigateTab(tabId, url, force) {
  const tab = await chrome.tabs.get(tabId);
  const current = (tab && tab.url) || "";
  const loading = !tab || tab.status === "loading" || current === "" || current === "about:blank";
  if (!force && (loading || sameDocument(current, url))) {
    await chrome.tabs.update(tabId, { active: true });
    return loading ? "bereits-am-laden" : "schon-offen";
  }
  try {
    await chrome.tabs.update(tabId, { active: true, url });
    return "navigiert";
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (/navigation rejected/i.test(msg)) return "navigation-rejected";
    throw e;
  }
}

async function countSelector(tabId, selector) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => document.querySelectorAll(sel).length,
    args: [selector],
  });
  return res && typeof res.result === "number" ? res.result : 0;
}

async function waitForSelector(tabId, selector, timeoutMs) {
  const start = Date.now();
  let count = 0;
  while (Date.now() - start < timeoutMs) {
    try {
      count = await countSelector(tabId, selector);
    } catch (e) {
      count = 0;
    }
    if (count > 0) return count;
    await sleep(700);
  }
  return count;
}

async function scrapeTab(tabId, which) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["scrapers.js"],
  });
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (kind) => globalThis.__flatScrape(kind),
    args: [which],
  });
  return (res && res.result) || { rows: [], found: 0, url: "", title: "" };
}

async function loadSearch(tabId, url, selector, force) {
  const how = await navigateTab(tabId, url, force);
  await waitForComplete(tabId);
  await sleep(900);
  const mid = await chrome.tabs.get(tabId);
  if (!mid || mid.status !== "complete") await waitForComplete(tabId);
  let count = 0;
  try {
    count = await waitForSelector(tabId, selector, 20000);
  } catch (e) {
    count = 0;
  }
  const tab = await chrome.tabs.get(tabId);
  return { count, finalUrl: (tab && tab.url) || url, how };
}

function hostOk(agent, raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || "").trim());
  } catch (e) {
    return "Such-URL ist ungueltig.";
  }
  if (parsed.protocol !== "https:") return "Nur https-URLs.";
  const ok = agent.hosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith("." + host));
  if (!ok) return "URL passt nicht zu " + agent.subagent + ".";
  return "";
}

async function runAgent(msg) {
  const agent = agentById(msg.agentId);
  if (!agent) return { ok: false, error: "Unbekannter Subagent.", rows: [], log: [] };
  const pages = Math.max(1, Math.min(3, Number(msg.pages) || 1));
  const startUrl = String(msg.url || agent.defaultUrl).trim();
  const bad = hostOk(agent, startUrl);
  if (bad) return { ok: false, error: bad, rows: [], log: [agent.subagent + ": " + bad] };

  const log = [];
  const rows = [];
  const seen = new Set();
  const firstUrl = pageUrl(agent, startUrl, 1);
  const opened = await ensureTab(firstUrl);
  const tabId = opened.tabId;
  log.push(agent.subagent + " oeffnet " + firstUrl);

  for (let page = 1; page <= pages; page++) {
    const url = pageUrl(agent, startUrl, page);
    const force = page > 1;
    let loaded = await loadSearch(tabId, url, agent.waitSelector, force);
    log.push("Seite " + page + ": " + loaded.how + ", " + loaded.count + " Knoten, " + loaded.finalUrl);

    if (loaded.how === "navigation-rejected") {
      log.push("Redirect lief schon. Warte, dann einmal nachziehen.");
      await waitForComplete(tabId);
      await sleep(1200);
      loaded = await loadSearch(tabId, url, agent.waitSelector, true);
      log.push("Nachzug: " + loaded.how + ", " + loaded.count + " Knoten, " + loaded.finalUrl);
    }

    if (loaded.count === 0 && agent.id === "immoscout") {
      const alt = siblingIs24(loaded.finalUrl || url);
      if (alt && !sameDocument(alt, loaded.finalUrl || url)) {
        log.push("Keine div[data-obid]. Zweiter Host: " + alt);
        loaded = await loadSearch(tabId, alt, agent.waitSelector, true);
        log.push("Fallback: " + loaded.how + ", " + loaded.count + " Knoten, " + loaded.finalUrl);
      }
    }

    if (loaded.count === 0) {
      let title = "";
      try {
        const shot = await scrapeTab(tabId, agent.scrape);
        title = shot.title || "";
      } catch (e) {
        title = String(e && e.message ? e.message : e);
      }
      log.push("Keine Bloecke. Seitentitel: " + (title || "(leer)"));
      if (rows.length === 0) {
        return {
          ok: false,
          error: agent.subagent + ": keine Ergebnis-Bloecke. Cookie-Dialog im offenen Tab selbst bestaetigen.",
          log,
          rows: [],
        };
      }
      break;
    }

    const shot = await scrapeTab(tabId, agent.scrape);
    let added = 0;
    for (const row of shot.rows || []) {
      const key = row.source + ":" + (row.id || row.url);
      if (!row.id && !row.url) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
      added += 1;
    }
    log.push(agent.subagent + " Seite " + page + ": " + added + " neue Zeilen");
    if (page < pages) await sleep(1200);
  }

  return { ok: rows.length > 0, rows, log, subagent: agent.subagent };
}

async function runQueue(msg, port, isCancelled) {
  if (queueRunning) {
    post(port, { type: "done", ok: false, rows: [], log: [], error: "Ein Lauf ist schon aktiv." });
    return;
  }
  queueRunning = true;
  try {
    const picked = Array.isArray(msg.subagents) ? msg.subagents : [];
    const log = [];
    const rows = [];
    const seen = new Set();
    if (!picked.length) {
      post(port, { type: "done", ok: false, rows, log, error: "Keine Subagents gewaehlt." });
      return;
    }

    log.push("Queue, nacheinander, nicht parallel: " + picked.map((item) => item.id).join(" -> "));
    post(port, { type: "progress", log: log.slice(), rows: [] });

    for (let i = 0; i < picked.length; i++) {
      if (isCancelled()) {
        log.push("Abbruch: Fenster zu.");
        break;
      }
      const item = picked[i];
      log.push("--- " + (i + 1) + "/" + picked.length + " " + item.id + " ---");
      post(port, { type: "progress", log: log.slice(), rows: rows.slice() });

      let part;
      try {
        part = await runAgent({ agentId: item.id, url: item.url, pages: msg.pages });
      } catch (err) {
        part = { rows: [], log: [], error: String(err && err.message ? err.message : err) };
      }
      for (const line of part.log || []) log.push(line);
      if (part.error) log.push(part.error);
      for (const row of part.rows || []) {
        const key = row.source + ":" + (row.id || row.url);
        if (!row.id && !row.url) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
      }
      post(port, { type: "progress", log: log.slice(), rows: rows.slice() });
      if (i < picked.length - 1 && !isCancelled()) await sleep(1200);
    }

    const result = {
      type: "done",
      ok: rows.length > 0,
      rows,
      log,
      subagentIds: picked.map((item) => item.id),
      at: new Date().toISOString(),
    };
    await chrome.storage.local.set({ lastRun: result });
    post(port, result);
  } finally {
    queueRunning = false;
  }
}
