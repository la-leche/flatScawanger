import { agents, getAgent, MAX_PAGES } from "./agents.js";
import { downloadCsv, toCsv } from "./export-csv.js";

const app = document.querySelector("#app");
const title = document.querySelector("#title");
let lastRun = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderRows(list) {
  const table = el("table");
  const head = document.createElement("tr");
  for (const name of ["Titel", "Preis", "Groesse", "Zimmer", "Lage", "Link"]) {
    head.append(el("th", "", name));
  }
  table.append(document.createElement("thead")).append(head);
  const body = document.createElement("tbody");
  for (const row of list) {
    const tr = document.createElement("tr");
    for (const value of [row.title || row.id, row.price, row.size, row.rooms, row.location]) {
      tr.append(el("td", "", value || ""));
    }
    const td = el("td");
    if (row.url && row.url.startsWith("https://")) {
      const a = el("a", "", "oeffnen");
      a.href = row.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      td.append(a);
    }
    tr.append(td);
    body.append(tr);
  }
  table.append(body);
  return table;
}

function renderAgents() {
  title.textContent = "Agents";
  app.replaceChildren();
  const list = el("div");
  for (const agent of agents) {
    const btn = el("button", "agent");
    btn.type = "button";
    btn.append(el("strong", "", agent.name), el("span", "", agent.blurb));
    btn.addEventListener("click", () => renderParser(agent.id));
    list.append(btn);
  }
  app.append(list);
}

function renderParser(agentId) {
  const agent = getAgent(agentId);
  if (!agent) return renderAgents();
  title.textContent = agent.name;
  app.replaceChildren();

  const note = el("p", "muted", agent.hint);
  const urlLabel = el("label", "", "Such-URL");
  urlLabel.htmlFor = "url";
  const urlInput = document.createElement("input");
  urlInput.id = "url";
  urlInput.type = "url";
  urlInput.spellcheck = false;
  urlInput.value = agent.defaultUrl;

  const actions = el("div", "row");
  const pagesLabel = el("label", "", "Seiten (1-" + MAX_PAGES + ")");
  const pagesInput = document.createElement("input");
  pagesInput.type = "number";
  pagesInput.min = "1";
  pagesInput.max = String(MAX_PAGES);
  pagesInput.value = "1";
  pagesLabel.append(pagesInput);

  const start = el("button", "primary", "Start");
  start.type = "button";
  const exp = el("button", "", "CSV exportieren");
  exp.type = "button";
  exp.disabled = true;
  const log = el("pre", "log", "idle");

  if (lastRun && lastRun.agentId === agent.id && lastRun.rows) {
    exp.disabled = lastRun.rows.length === 0;
    log.textContent = "Letzter Lauf:\n" + (lastRun.log || []).join("\n");
  }

  start.addEventListener("click", async () => {
    start.disabled = true;
    exp.disabled = true;
    log.textContent = agent.id + "-search sucht. Der Tab bleibt offen.";
    try {
      const result = await chrome.runtime.sendMessage({
        type: "RUN_AGENT",
        agentId: agent.id,
        url: urlInput.value.trim(),
        pages: Number(pagesInput.value) || 1,
      });
      if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
      lastRun = result || { rows: [], log: [], error: "Keine Antwort." };
      const lines = lastRun.log || [];
      log.textContent = lines.join("\n") + (lastRun.error ? "\n" + lastRun.error : "");
      exp.disabled = !(lastRun.rows && lastRun.rows.length);
      const old = app.querySelector("table");
      if (old) old.remove();
      if (lastRun.rows && lastRun.rows.length) app.append(renderRows(lastRun.rows));
    } catch (err) {
      log.textContent = String(err && err.message ? err.message : err);
    } finally {
      start.disabled = false;
    }
  });

  exp.addEventListener("click", () => {
    if (!lastRun || lastRun.agentId !== agent.id) return;
    const stamp = String(lastRun.startedAt || new Date().toISOString()).replace(/[:.]/g, "-");
    downloadCsv(agent.id + "-" + stamp + ".csv", toCsv(lastRun.rows || []));
  });

  const back = el("button", "", "Zurueck zu den Agents");
  back.type = "button";
  back.style.marginTop = "12px";
  back.addEventListener("click", renderAgents);

  actions.append(pagesLabel, start, exp);
  app.append(note, urlLabel, urlInput, actions, log, back);
  if (lastRun && lastRun.agentId === agent.id && lastRun.rows && lastRun.rows.length) {
    app.append(renderRows(lastRun.rows));
  }
}

chrome.storage.local.get("lastRun", (stored) => {
  lastRun = stored && stored.lastRun;
  if (lastRun && lastRun.agentId && getAgent(lastRun.agentId)) renderParser(lastRun.agentId);
  else renderAgents();
});
