const logEl = document.getElementById("log");
const labelEl = document.getElementById("app-label");
const closeBtn = document.getElementById("close-btn");

function appendLog(label: string, value: string): void {
  if (!logEl) return;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${new Date().toLocaleTimeString()}] ${label}: ${value}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

const api = window.meetcopilot;

if (labelEl) {
  labelEl.textContent = api.appName;
}

api.onLog((entry) => appendLog(entry.label, entry.value));
closeBtn?.addEventListener("click", () => api.close());

appendLog("Overlay", "renderer ready");
