import { ALLOWED_HOSTS, MAX_PAGES } from "../agents.js";
import { canonical, isAllowedUrl, pageUrl, siblingHost } from "./urls.js";
import { ensureTab, loadSearch, scrapeTab, sleep } from "./tabs.js";

function takeRows(shot, seen, rows) {
  let added = 0;
  for (const row of shot.rows || []) {
    if (!row.id && !row.url) continue;
    const key = row.source + ":" + (row.id || row.url);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
    added += 1;
  }
  return added;
}

export async function runSearch({ agent, url, pages }) {
  const log = [];
  const wanted = Math.max(1, Math.min(MAX_PAGES, Number(pages) || 1));
  const startUrl = String(url || agent.defaultUrl).trim();
  if (!isAllowedUrl(startUrl, ALLOWED_HOSTS)) {
    return {
      rows: [],
      log,
      error: "URL muss https auf ImmoScout24 oder Kleinanzeigen sein.",
    };
  }

  const rows = [];
  const seen = new Set();
  const firstUrl = pageUrl(agent.id, startUrl, 1);
  const opened = await ensureTab(firstUrl);
  log.push(agent.id + "-search oeffnet " + firstUrl);

  for (let page = 1; page <= wanted; page++) {
    const target = pageUrl(agent.id, startUrl, page);
    let loaded = await loadSearch(opened.tabId, target, agent.waitSelector, page > 1);
    log.push("Seite " + page + ": " + loaded.how + ", " + loaded.count + " Knoten, " + loaded.finalUrl);

    if (loaded.how === "navigation-rejected") {
      log.push("Redirect lief schon. Warte, dann einmal nachziehen.");
      loaded = await loadSearch(opened.tabId, target, agent.waitSelector, true);
      log.push("Nachzug: " + loaded.how + ", " + loaded.count + " Knoten, " + loaded.finalUrl);
    }

    if (loaded.count === 0 && agent.id === "immoscout") {
      const alt = siblingHost(loaded.finalUrl || target);
      if (alt && canonical(alt) !== canonical(loaded.finalUrl || target)) {
        log.push("Keine div[data-obid]. Zweiter Host: " + alt);
        loaded = await loadSearch(opened.tabId, alt, agent.waitSelector, true);
        log.push("Fallback: " + loaded.how + ", " + loaded.count + " Knoten, " + loaded.finalUrl);
      }
    }

    if (loaded.count === 0) {
      let title = "";
      try {
        title = (await scrapeTab(opened.tabId, agent.scrape)).title || "";
      } catch (err) {
        title = String(err && err.message ? err.message : err);
      }
      log.push("Keine Bloecke. Seitentitel: " + (title || "(leer)"));
      if (rows.length === 0) {
        return {
          rows: [],
          log,
          error: "Keine Ergebnis-Bloecke. Cookie-Dialog im offenen Tab selbst bestaetigen, dann nochmal Start.",
        };
      }
      break;
    }

    const added = takeRows(await scrapeTab(opened.tabId, agent.scrape), seen, rows);
    log.push("Seite " + page + ": " + added + " neue Zeilen");
    if (page < wanted) await sleep(1200);
  }

  return { rows, log };
}
