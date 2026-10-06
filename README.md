# flatScawanger

Chrome extension.

1. Main window: pick an agent (Immoscout, Kleinanzeigen).
2. Parser: starts that agent's subagents. Subagents are empty.
3. Export CSV: writes the parser rows. Header only until a subagent returns data.

## Load

1. `chrome://extensions`
2. Developer mode
3. Load unpacked
4. Select this folder
5. Click the toolbar icon

## Add a subagent later

In `subagents/registry.js`, put a `{ id, run }` on that agent. `run()` returns row objects with `source`, `id`, `title`, `price`, `location`, `url`, `scraped_at`.
