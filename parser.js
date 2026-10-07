import { registry } from "./subagents/registry.js";

const FIELDS = ["source", "id", "title", "price", "size", "rooms", "location", "url", "text", "scraped_at"];

function normalize(item, agentId, startedAt) {
  const row = {};
  for (const key of FIELDS) row[key] = item && item[key] ? String(item[key]) : "";
  if (!row.source) row.source = agentId;
  if (!row.scraped_at) row.scraped_at = startedAt;
  return row;
}

export async function startParser(agent, { url, pages }) {
  const startedAt = new Date().toISOString();
  const log = ["parser start: " + agent.id];
  const subagents = registry[agent.id] || [];
  const rows = [];
  let error = "";

  if (!subagents.length) {
    log.push("no subagents");
    return { ok: false, agentId: agent.id, startedAt, rows, log, error: "Keine Subagents." };
  }

  for (const sub of subagents) {
    const name = sub.id || "unnamed";
    log.push("run subagent: " + name);
    if (typeof sub.run !== "function") {
      log.push("skip " + name + ": no run()");
      continue;
    }
    const part = await sub.run({ agent, url, pages, startedAt });
    for (const line of (part && part.log) || []) log.push(line);
    if (part && part.error) error = part.error;
    for (const item of (part && part.rows) || []) rows.push(normalize(item, agent.id, startedAt));
    log.push(name + ": " + ((part && part.rows && part.rows.length) || 0) + " rows");
  }

  log.push("done: " + rows.length + " rows");
  return {
    ok: rows.length > 0,
    agentId: agent.id,
    startedAt,
    rows,
    log,
    error: rows.length ? "" : error,
  };
}
