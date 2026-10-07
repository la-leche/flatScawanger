# flatScawanger

Chrome extension. Pick ImmoScout24 or Kleinanzeigen, open the search once, read the listing blocks, export CSV.

Version 2.1.0 fills the 2.0.0 subagent shell with the working scrapers. The control window stays separate from the listing tab.

| Agent | Default URL | HTML |
| --- | --- | --- |
| ImmoScout24 | https://www.immoscout24.de/Suche/de/hessen/frankfurt-am-main/wohnung-mieten | `div[data-obid]` |
| Kleinanzeigen | https://www.kleinanzeigen.de/s-wohnung-mieten/frankfurt-am-main/c203l4292 | `#srchrslt-adtable > li` |

## Load

1. `chrome://extensions`
2. Developer mode
3. Load unpacked, or Reload if this folder is already loaded
4. Click the toolbar icon
5. Start. Confirm the cookie dialog in the listing tab yourself, then Start again if the first pass finds no blocks.

Page 1 is opened once. A second `tabs.update` while Kleinanzeigen is still redirecting to `/c203l4292` was the cause of `Navigation rejected`.

## Layout

- `main.js` picks the agent and exports CSV
- `parser.js` runs that agent's subagents
- `subagents/*-search.js` open the search tab and paginate (max 3)
- `scrapers.js` is injected into the listing tab and returns plain row objects

CSV columns: `source`, `id`, `title`, `price`, `size`, `rooms`, `location`, `url`, `text`, `scraped_at`. Semicolon separated, with a UTF-8 BOM for Excel.
