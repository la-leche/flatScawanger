import { run as runImmoscout } from "./immoscout-search.js";
import { run as runKleinanzeigen } from "./kleinanzeigen-search.js";

// run(ctx) returns { rows, log, error? }.
// Row: { source, id, title, price, size, rooms, location, url, text, scraped_at }
export const registry = {
  immoscout: [{ id: "immoscout-search", run: runImmoscout }],
  kleinanzeigen: [{ id: "kleinanzeigen-search", run: runKleinanzeigen }],
};
