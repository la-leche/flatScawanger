// Selectable parsers. Subagents that actually read pages live in subagents/registry.js.
export const MAX_PAGES = 3;

export const ALLOWED_HOSTS = [
  "immoscout24.de",
  "immobilienscout24.de",
  "kleinanzeigen.de",
];

export const agents = [
  {
    id: "immoscout",
    name: "ImmoScout24",
    blurb: "Frankfurter Miet-Suche, div[data-obid]",
    defaultUrl: "https://www.immoscout24.de/Suche/de/hessen/frankfurt-am-main/wohnung-mieten",
    waitSelector: "div[data-obid]",
    scrape: "immoscout",
    hint: "Liest jedes div[data-obid]. Bei leerer Liste wird der andere Is24-Host einmal versucht.",
  },
  {
    id: "kleinanzeigen",
    name: "Kleinanzeigen",
    blurb: "Frankfurter Miet-Suche, #srchrslt-adtable",
    defaultUrl: "https://www.kleinanzeigen.de/s-wohnung-mieten/frankfurt-am-main/c203l4292",
    waitSelector: "#srchrslt-adtable > li",
    scrape: "kleinanzeigen",
    hint: "Liest die li in #srchrslt-adtable. Kein zweites tabs.update, waehrend der Redirect laeuft.",
  },
];

export function getAgent(id) {
  return agents.find((agent) => agent.id === id) || null;
}
