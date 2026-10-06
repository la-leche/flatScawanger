import { registry } from "./subagents/registry.js";

// Starter. Does not scrape. It only runs the selected agent's subagents.
export async function startParser(agent) {
  const startedAt = new Date().toISOString();
  const log = [`parser start: ${agent.id}`];
  const rows = [];
  const subagents = registry[agent.id] || agent.subagents || [];

  if (!subagents.length) {
    log.push("no subagents");
  }

  for (const sub of subagents) {
    const name = sub.id || "unnamed";
    log.push(`run subagent: ${name}`);
    if (typeof sub.run !== "function") {
      log.push(`skip ${name}: no run()`);
      continue;
    }
    const part = await sub.run({ agentId: agent.id, startedAt });
    const items = Array.isArray(part) ? part : [];
    log.push(`${name}: ${items.length} rows`);
    for (const item of items) {
      rows.push({
        source: item.source || agent.id,
        id: item.id || "",
        title: item.title || "",
        price: item.price || "",
        location: item.location || "",
        url: item.url || "",
        scraped_at: item.scraped_at || startedAt,
      });
    }
  }

  log.push(`done: ${rows.length} rows`);
  return { agentId: agent.id, startedAt, rows, log };
}
