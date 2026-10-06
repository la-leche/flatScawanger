// Subagents do the actual page reads.
// Leave this empty. Parser still starts and just finds nothing to run.
//
// Later, register one like:
//   import { parseList } from "./immoscout-list.js";
//   registry.immoscout = [{ id: "list", run: parseList }];
//
// run(ctx) must return an array of row objects:
//   { source, id, title, price, location, url, scraped_at }

export const registry = {
  immoscout: [],
  kleinanzeigen: [],
};
