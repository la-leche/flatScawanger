import { agents, getAgent } from "./agents.js";
import { startParser } from "./parser.js";

let windowId = null;

chrome.action.onClicked.addListener(async () => {
  if (windowId != null) {
    try {
      await chrome.windows.get(windowId);
      await chrome.windows.update(windowId, { focused: true });
      return;
    } catch {
      windowId = null;
    }
  }
  const created = await chrome.windows.create({
    url: chrome.runtime.getURL("main.html"),
    type: "popup",
    width: 1100,
    height: 780,
    focused: true,
  });
  windowId = created.id ?? null;
});

chrome.windows.onRemoved.addListener((id) => {
  if (id === windowId) windowId = null;
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type === "GET_AGENTS") {
    sendResponse({ agents });
    return;
  }
  if (msg.type !== "RUN_AGENT") return;

  const agent = getAgent(msg.agentId);
  if (!agent) {
    sendResponse({ ok: false, error: "Unbekannter Agent.", rows: [], log: [] });
    return;
  }

  startParser(agent, { url: msg.url, pages: msg.pages })
    .then(async (result) => {
      await chrome.storage.local.set({ lastRun: result });
      sendResponse(result);
    })
    .catch((err) => {
      sendResponse({
        ok: false,
        error: String(err && err.message ? err.message : err),
        rows: [],
        log: [],
      });
    });
  return true;
});
