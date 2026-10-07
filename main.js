const agentSelect = document.querySelector("#agent");
const urlInput = document.querySelector("#url");
const pagesInput = document.querySelector("#pages");
const hint = document.querySelector("#hint");
const startBtn = document.querySelector("#start");
const csvBtn = document.querySelector("#csv");
const logEl = document.querySelector("#log");
const rowsEl = document.querySelector("#rows");

let agents = [];
let rows = [];

function selectedAgent() {
  return agents.find((a) => a.id === agentSelect.value) || agents[0];
}

function renderAgents() {
  agentSelect.innerHTML = "";
  for (const agent of agents) {
    const opt = document.createElement("option");
    opt.value = agent.id;
    opt.textContent = agent.name + " / " + agent.subagent;
    agentSelect.appendChild(opt);
  }
  applyAgent();
}

function applyAgent() {
  const agent = selectedAgent();
  if (!agent) return;
  urlInput.value = agent.defaultUrl;
  hint.textContent = agent.hint + " Selektor: " + agent.waitSelector;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRows(list) {
  rowsEl.replaceChildren();
  for (const row of list) {
    const tr = document.createElement("tr");
    const cells = [row.title || row.id, row.price, row.size, row.rooms, row.location];
    for (const value of cells) {
      const td = document.createElement("td");
      td.textContent = value || "";
      tr.appendChild(td);
    }
    const td = document.createElement("td");
    if (row.url) {
      const a = document.createElement("a");
      a.href = row.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = "oeffnen";
      td.appendChild(a);
    }
    tr.appendChild(td);
    rowsEl.appendChild(tr);
  }
}

function toCsv(list) {
  const headers = ["source", "id", "title", "price", "size", "rooms", "location", "url", "text", "scraped_at"];
  const esc = (value) => {
    const s = String(value ?? "");
    if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [headers.join(";")];
  for (const row of list) lines.push(headers.map((h) => esc(row[h])).join(";"));
  return "\uFEFF" + lines.join("\r\n");
}

agentSelect.addEventListener("change", applyAgent);

startBtn.addEventListener("click", async () => {
  const agent = selectedAgent();
  if (!agent) return;
  startBtn.disabled = true;
  csvBtn.disabled = true;
  logEl.textContent = agent.subagent + " sucht. Der Tab bleibt offen.";
  try {
    const result = await chrome.runtime.sendMessage({
      type: "RUN_AGENT",
      agentId: agent.id,
      url: urlInput.value.trim(),
      pages: Number(pagesInput.value) || 1,
    });
    rows = (result && result.rows) || [];
    const lines = (result && result.log) || [];
    logEl.textContent = lines.join("\n") + (result && result.error ? "\n" + result.error : "");
    renderRows(rows);
    csvBtn.disabled = rows.length === 0;
  } catch (err) {
    logEl.textContent = String(err && err.message ? err.message : err);
  } finally {
    startBtn.disabled = false;
  }
});

csvBtn.addEventListener("click", () => {
  const agent = selectedAgent();
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "flats-" + (agent ? agent.id : "export") + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

chrome.runtime.sendMessage({ type: "GET_AGENTS" }, (res) => {
  agents = (res && res.agents) || [];
  renderAgents();
});

chrome.storage.local.get("lastRun", (stored) => {
  const last = stored && stored.lastRun;
  if (!last || !last.rows) return;
  rows = last.rows;
  renderRows(rows);
  csvBtn.disabled = rows.length === 0;
  if (last.log) logEl.textContent = "Letzter Lauf:\n" + last.log.join("\n");
});