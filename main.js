import { agents, getAgent } from "./agents.js";
import { startParser } from "./parser.js";
import { toCsv, downloadCsv } from "./export-csv.js";

const app = document.querySelector("#app");
const title = document.querySelector("#title");

let selectedId = null;
let lastRun = null;

function renderAgents() {
  selectedId = null;
  title.textContent = "Agents";
  app.replaceChildren();

  const list = document.createElement("div");
  for (const agent of agents) {
    const btn = document.createElement("button");
    btn.className = "agent";
    btn.type = "button";
    const name = document.createElement("strong");
    name.textContent = agent.name;
    const blurb = document.createElement("span");
    blurb.textContent = agent.blurb;
    btn.append(name, blurb);
    btn.addEventListener("click", () => renderParser(agent.id));
    list.append(btn);
  }
  app.append(list);
}

function renderParser(agentId) {
  const agent = getAgent(agentId);
  if (!agent) return renderAgents();
  selectedId = agentId;
  title.textContent = agent.name;
  app.replaceChildren();

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = "Parser starts this agent's subagents, then you export CSV.";

  const back = document.createElement("button");
  back.type = "button";
  back.className = "ghost";
  back.textContent = "Back to agents";
  back.addEventListener("click", renderAgents);

  const actions = document.createElement("div");
  actions.className = "row";

  const start = document.createElement("button");
  start.type = "button";
  start.className = "primary";
  start.textContent = "Start parser";

  const exp = document.createElement("button");
  exp.type = "button";
  exp.textContent = "Export CSV";
  exp.disabled = true;

  const log = document.createElement("pre");
  log.className = "log";
  log.textContent = "idle";

  start.addEventListener("click", async () => {
    start.disabled = true;
    log.textContent = "starting...";
    try {
      lastRun = await startParser(agent);
      exp.disabled = false;
      log.textContent = lastRun.log.join("\n");
    } catch (err) {
      log.textContent = "parser failed: " + (err && err.message ? err.message : err);
    } finally {
      start.disabled = false;
    }
  });

  exp.addEventListener("click", () => {
    if (!lastRun || lastRun.agentId !== agent.id) return;
    const stamp = lastRun.startedAt.replace(/[:.]/g, "-");
    downloadCsv(`${agent.id}-${stamp}.csv`, toCsv(lastRun.rows));
  });

  actions.append(start, exp);
  app.append(note, actions, log, back);
}

renderAgents();
