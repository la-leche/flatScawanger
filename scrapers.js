// Injected into the result tab. Reads only chunks the search page already rendered.
(function () {
  function linesOf(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function matchPrice(text) {
    const m = String(text).match(
      /(\d{1,3}(?:\.\d{3})*(?:,\d+)?(?:\s*[-–]\s*\d{1,3}(?:\.\d{3})*(?:,\d+)?)?\s*€(?:\s*VB)?)/
    );
    return m ? m[1].replace(/\s+/g, " ").trim() : "";
  }

  function matchSize(text) {
    const m = String(text).match(
      /(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*m²)/
    );
    return m ? m[1].replace(/\s+/g, " ").trim() : "";
  }

  function matchRooms(text) {
    const m = String(text).match(
      /(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*Zi\.?)/i
    );
    return m ? m[1].replace(/\s+/g, " ").trim() : "";
  }

  function matchLocation(text) {
    const lines = linesOf(text);
    const withZip = lines.find((l) => /\b\d{5}\b/.test(l));
    if (withZip) return withZip.replace(/\s+/g, " ");
    const frankfurt = lines.find((l) => /Frankfurt/i.test(l));
    if (frankfurt) return frankfurt.replace(/\s+/g, " ");
    const skip = /€|m²|Zi\.?|^[A-H]\+{0,2}$|^Neu$|^von privat$|^Bauprojekt$|^Anzeige$/i;
    const rest = lines.filter((l) => l.length > 8 && !skip.test(l));
    return rest.length ? rest[rest.length - 1].replace(/\s+/g, " ") : "";
  }

  function matchTitle(text, explicit) {
    const given = String(explicit || "").replace(/\s+/g, " ").trim();
    if (given.length > 8) return given;
    const skip = /€|m²|Zi\.?|^[A-H]\+{0,2}$|^Neu$|^von privat$|^Bauprojekt$/i;
    const line = linesOf(text).find((l) => l.length > 12 && !skip.test(l));
    return line ? line.replace(/\s+/g, " ") : "";
  }

  function absUrl(href) {
    if (!href) return "";
    try {
      return new URL(href, location.href).href;
    } catch (e) {
      return href;
    }
  }

  function rowBase(source, id, title, text, url) {
    const clean = String(text || "").replace(/\u00a0/g, " ").trim();
    return {
      source,
      id: String(id || ""),
      title: matchTitle(clean, title),
      price: matchPrice(clean),
      size: matchSize(clean),
      rooms: matchRooms(clean),
      location: matchLocation(clean),
      url: url || "",
      text: clean.replace(/\s+/g, " ").slice(0, 800),
      scraped_at: new Date().toISOString(),
    };
  }

  globalThis.__flatScrape = function (which) {
    if (which === "immoscout") return scrapeImmoscout();
    if (which === "kleinanzeigen") return scrapeKleinanzeigen();
    return { rows: [], found: 0, url: location.href, title: document.title, error: "unknown scraper" };
  };

  function scrapeImmoscout() {
    const nodes = Array.from(document.querySelectorAll("div[data-obid]"));
    const byId = new Map();
    for (const el of nodes) {
      const id = (el.getAttribute("data-obid") || "").trim();
      if (!id) continue;
      const prev = byId.get(id);
      if (prev && (prev.innerText || "").length >= (el.innerText || "").length) continue;
      byId.set(id, el);
    }
    const rows = [];
    for (const [id, el] of byId) {
      const links = Array.from(el.querySelectorAll("a[href]"));
      const expose = links.find((a) => /\/expose\/\d+/.test(a.getAttribute("href") || ""));
      const titled = links.find((a) => (a.textContent || "").trim().length > 8);
      const chosen = expose || titled || links[0];
      const href = chosen ? absUrl(chosen.getAttribute("href")) : "";
      const heading = el.querySelector("h2, h3, h4");
      rows.push(
        rowBase(
          "immoscout",
          id,
          heading ? heading.innerText : titled ? titled.innerText : "",
          el.innerText,
          href || "https://www.immobilienscout24.de/expose/" + id
        )
      );
    }
    return { rows, found: nodes.length, unique: rows.length, url: location.href, title: document.title };
  }

  function scrapeKleinanzeigen() {
    const items = Array.from(document.querySelectorAll("#srchrslt-adtable > li"));
    const rows = [];
    const seen = new Set();
    for (const li of items) {
      const article = li.querySelector("article");
      const link = li.querySelector('a[href*="/s-anzeige/"]');
      const id = (article && article.getAttribute("data-adid")) || li.getAttribute("data-adid") || "";
      if (!article && !link && !id) continue;
      const rawHref = (article && article.getAttribute("data-href")) || (link && link.getAttribute("href")) || "";
      const url = absUrl(rawHref);
      const key = id || url;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const titleEl = li.querySelector("h2 a, a.ellipsis, h2");
      const priceEl = li.querySelector(".aditem-main--middle--price-shipping--price, .aditem-main--middle .price");
      const locEl = li.querySelector(".aditem-main--top--left");
      const text = [li.innerText, priceEl && priceEl.innerText, locEl && locEl.innerText].filter(Boolean).join("\n");
      const parsed = rowBase(
        "kleinanzeigen",
        id || (url.match(/\/(\d+)(?:[/?#]|$)/) || [])[1] || "",
        titleEl ? titleEl.innerText : "",
        text,
        url
      );
      if (locEl && locEl.innerText.trim()) parsed.location = locEl.innerText.replace(/\s+/g, " ").trim();
      if (priceEl && priceEl.innerText.trim()) parsed.price = priceEl.innerText.replace(/\s+/g, " ").trim();
      rows.push(parsed);
    }
    return { rows, found: items.length, unique: rows.length, url: location.href, title: document.title };
  }
})();