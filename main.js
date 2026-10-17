const box = document.querySelector("#subagents");
const pagesInput = document.querySelector("#pages");
const startBtn = document.querySelector("#start");
const csvBtn = document.querySelector("#csv");
const logEl = document.querySelector("#log");
const rowsEl = document.querySelector("#rows");
let agents = [];
let rows = [];
let runPort = null;

function renderAgents(selectedIds) {
  box.replaceChildren();
  const wanted = selectedIds && selectedIds.length ? new Set(selectedIds) : null;
  for (const agent of agents) {
    const wrap = document.createElement("div");
    wrap.className = "sub";

    const check = document.createElement("label");
    check.className = "check";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.id = agent.id;
    cb.checked = wanted ? wanted.has(agent.id) : true;
    const name = document.createElement("span");
    name.textContent = agent.subagent + " / " + agent.name;
    check.append(cb, name);

    const url = document.createElement("input");
    url.type = "url";
    url.spellcheck = false;
    url.dataset.id = agent.id;
    url.value = agent.defaultUrl;
    url.setAttribute("aria-label", agent.subagent + " URL");

    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = agent.hint;

    wrap.append(check, url, hint);
    box.append(wrap);
  }
}

function selectedSubagents() {
  const items = [];
  for (const cb of box.querySelectorAll('input[type="checkbox"]')) {
    if (!cb.checked) continue;
    const url = box.querySelector('input[type="url"][data-id="' + cb.dataset.id + '"]');
    items.push({ id: cb.dataset.id, url: url ? url.value.trim() : "" });
  }
  return items;
}

function renderRows(list) {
  rowsEl.replaceChildren();
  for (const row of list) {
    const tr = document.createElement("tr");
    for (const value of [row.source, row.title || row.id, row.price, row.size, row.rooms, row.location]) {
      const td = document.createElement("td");
      td.textContent = value || "";
      tr.appendChild(td);
    }
    const td = document.createElement("td");
    if (row.url && String(row.url).startsWith("https://")) {
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

function show(msg) {
  const lines = (msg && msg.log) || [];
  logEl.textContent = lines.join("\n") + (msg && msg.error ? "\n" + msg.error : "");
  if (msg && msg.rows) {
    rows = msg.rows;
    renderRows(rows);
  }
}

startBtn.addEventListener("click", () => {
  const subagents = selectedSubagents();
  if (!subagents.length) {
    logEl.textContent = "Keine Subagents gewaehlt.";
    return;
  }
  if (runPort) {
    try { runPort.disconnect(); } catch (e) {}
    runPort = null;
  }
  startBtn.disabled = true;
  csvBtn.disabled = true;
  rows = [];
  renderRows(rows);
  logEl.textContent = subagents.map((item) => item.id).join(" -> ") + "\nWartet auf den ersten Subagent.";

  let finished = false;
  const port = chrome.runtime.connect({ name: "run" });
  runPort = port;
  port.onMessage.addListener((msg) => {
    show(msg);
    if (msg && msg.type === "done") {
      finished = true;
      csvBtn.disabled = rows.length === 0;
      startBtn.disabled = false;
      try { port.disconnect(); } catch (e) {}
      if (runPort === port) runPort = null;
    }
  });
  port.onDisconnect.addListener(() => {
    if (!finished) {
      logEl.textContent += "\nVerbindung weg. Lauf gestoppt vor dem naechsten Subagent.";
      startBtn.disabled = false;
      csvBtn.disabled = rows.length === 0;
    }
    if (runPort === port) runPort = null;
  });
  port.postMessage({
    type: "RUN_QUEUE",
    subagents,
    pages: Number(pagesInput.value) || 1,
  });
});

csvBtn.addEventListener("click", () => {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "flats-queue.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
});

chrome.runtime.sendMessage({ type: "GET_AGENTS" }, (res) => {
  agents = (res && res.agents) || [];
  chrome.storage.local.get("lastRun", (stored) => {
    const last = stored && stored.lastRun;
    renderAgents(last && last.subagentIds);
    if (!last || !last.rows) return;
    rows = last.rows;
    renderRows(rows);
    csvBtn.disabled = rows.length === 0;
    if (last.log) logEl.textContent = "Letzter Lauf:\n" + last.log.join("\n");
  });
});
