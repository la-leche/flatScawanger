export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitForComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve();
    };
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((tab) => {
      if (!tab || tab.status === "complete") finish();
    }).catch(() => finish());
  });
}

export async function ensureTab(url) {
  const { canonical } = await import("./urls.js");
  const target = canonical(url);
  const tabs = await chrome.tabs.query({});
  const hit = tabs.find((tab) => {
    if (!tab.url) return false;
    try {
      return canonical(tab.url) === target;
    } catch {
      return false;
    }
  });
  if (hit) {
    await chrome.tabs.update(hit.id, { active: true });
    return { tabId: hit.id, created: false };
  }
  const tab = await chrome.tabs.create({ url, active: true });
  return { tabId: tab.id, created: true };
}

// Kleinanzeigen rejects a second tabs.update while its own redirect is in flight.
export async function navigateTab(tabId, url, force) {
  const { canonical } = await import("./urls.js");
  const tab = await chrome.tabs.get(tabId);
  const current = (tab && tab.url) || "";
  const loading = !tab || tab.status === "loading" || current === "" || current === "about:blank";
  let same = false;
  try {
    same = current && canonical(current) === canonical(url);
  } catch {
    same = false;
  }
  if (!force && (loading || same)) {
    await chrome.tabs.update(tabId, { active: true });
    return loading ? "bereits-am-laden" : "schon-offen";
  }
  try {
    await chrome.tabs.update(tabId, { active: true, url });
    return "navigiert";
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (/navigation rejected/i.test(msg)) return "navigation-rejected";
    throw err;
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

export async function waitForSelector(tabId, selector, timeoutMs) {
  const start = Date.now();
  let count = 0;
  while (Date.now() - start < timeoutMs) {
    try {
      count = await countSelector(tabId, selector);
    } catch {
      count = 0;
    }
    if (count > 0) return count;
    await sleep(700);
  }
  return count;
}

export async function scrapeTab(tabId, which) {
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

export async function loadSearch(tabId, url, selector, force) {
  const how = await navigateTab(tabId, url, force);
  await waitForComplete(tabId);
  await sleep(900);
  const mid = await chrome.tabs.get(tabId);
  if (!mid || mid.status !== "complete") await waitForComplete(tabId);
  let count = 0;
  try {
    count = await waitForSelector(tabId, selector, 20000);
  } catch {
    count = 0;
  }
  const tab = await chrome.tabs.get(tabId);
  return { count, finalUrl: (tab && tab.url) || url, how };
}
