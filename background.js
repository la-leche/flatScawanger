const AGENTS = [
  {
    id: "immoscout",
    name: "ImmoScout24",
    subagent: "immoscout-search",
    defaultUrl: "https://www.immoscout24.de/Suche/de/hessen/frankfurt-am-main/wohnung-mieten",
    waitSelector: "div[data-obid]",
    scrape: "immoscout",
    hint: "Oeffnet die Frankfurter Miet-Suche und liest jedes div[data-obid].",
  },
  {
    id: "kleinanzeigen",
    name: "Kleinanzeigen",
    subagent: "kleinanzeigen-search",
    defaultUrl: "https://www.kleinanzeigen.de/s-wohnung-mieten/frankfurt-am-main",
    waitSelector: "#srchrslt-adtable > li",
    scrape: "kleinanzeigen",
    hint: "Oeffnet die Frankfurter Miet-Suche und liest die li in #srchrslt-adtable.",
  },
];

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("main.html");
  const open = await chrome.tabs.query({ url });
  if (open[0]) {
    await chrome.tabs.update(open[0].id, { active: true });
    if (open[0].windowId != null) await chrome.windows.update(open[0].windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_AGENTS") {
    sendResponse({ agents: AGENTS });
    return;
  }
  if (msg.type === "RUN_AGENT") {
    runAgent(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    return true;
  }
});

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
  u.pathname = u.pathname.replace(/\/seite:\d+\/?/, "/");
  if (page > 1) {
    const path = u.pathname.replace(/\/$/, "");
    u.pathname = path + "/seite:" + page;
  }
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
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab || tab.status === "complete") return finish();
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openOrReuse(url) {
  const target = new URL(url);
  const prefix = target.origin + target.pathname;
  const tabs = await chrome.tabs.query({});
  const hit = tabs.find((t) => t.url && t.url.split("?")[0].replace(/\/$/, "") === prefix.replace(/\/$/, ""));
  if (hit) {
    await chrome.tabs.update(hit.id, { active: true, url });
    return hit.id;
  }
  const tab = await chrome.tabs.create({ url, active: true });
  return tab.id;
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

async function loadSearch(tabId, url, selector) {
  await chrome.tabs.update(tabId, { url, active: true });
  await waitForComplete(tabId);
  await sleep(600);
  const count = await waitForSelector(tabId, selector, 20000);
  const tab = await chrome.tabs.get(tabId);
  return { count, finalUrl: (tab && tab.url) || url };
}

async function runAgent(msg) {
  const agent = agentById(msg.agentId);
  if (!agent) return { ok: false, error: "Unbekannter Agent." };
  const pages = Math.max(1, Math.min(3, Number(msg.pages) || 1));
  const startUrl = String(msg.url || agent.defaultUrl).trim();
  let parsed;
  try {
    parsed = new URL(startUrl);
  } catch (e) {
    return { ok: false, error: "Such-URL ist ungueltig." };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "Nur https-URLs." };
  const allowed = [
    "immoscout24.de",
    "immobilienscout24.de",
    "kleinanzeigen.de",
  ];
  if (!allowed.some((host) => parsed.hostname === host || parsed.hostname.endsWith("." + host))) {
    return { ok: false, error: "URL muss auf ImmoScout24 oder Kleinanzeigen liegen." };
  }

  const log = [];
  const rows = [];
  const seen = new Set();
  const firstUrl = pageUrl(agent, startUrl, 1);
  const tabId = await openOrReuse(firstUrl);
  log.push(agent.subagent + " oeffnet " + firstUrl);

  for (let page = 1; page <= pages; page++) {
    let url = pageUrl(agent, startUrl, page);
    let loaded;
    try {
      loaded = await loadSearch(tabId, url, agent.waitSelector);
    } catch (e) {
      console.log(e);
      return { ok: false, error: "Tab nicht lesbar: " + e.message, log, rows };
    }
    log.push("Seite " + page + ": " + loaded.count + " Knoten, " + loaded.finalUrl);

    if (loaded.count === 0 && agent.id === "immoscout") {
      const alt = siblingIs24(loaded.finalUrl || url);
      if (alt && alt !== (loaded.finalUrl || url)) {
        log.push("Keine div[data-obid]. Zweiter Host: " + alt);
        loaded = await loadSearch(tabId, alt, agent.waitSelector);
        log.push("Fallback: " + loaded.count + " Knoten, " + loaded.finalUrl);
      }
    }

    if (loaded.count === 0) {
      let title = "";
      try {
        const shot = await scrapeTab(tabId, agent.scrape);
        title = shot.title || "";
      } catch (e) {
        title = e.message;
      }
      log.push("Keine Bloecke. Seitentitel: " + (title || "(leer)"));
      if (rows.length === 0) {
        return {
          ok: false,
          error: "Keine Ergebnis-Bloecke. Im offenen Tab den Cookie-Dialog selbst bestaetigen, dann nochmal Start. Kein Captcha-Bypass.",
          log,
          rows: [],
          pageTitle: title,
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
    log.push(agent.subagent + " Seite " + page + ": " + added + " neue Zeilen, DOM-Knoten " + (shot.found || 0));
    if (page < pages) await sleep(1200);
  }

  await chrome.storage.local.set({
    lastRun: { agentId: agent.id, rows, log, at: new Date().toISOString() },
  });
  return { ok: true, rows, log, subagent: agent.subagent };
}