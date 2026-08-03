/** YAML formatter Tool SAM — pretty / validate; CDN js-yaml. */

import jsyaml from "https://esm.sh/js-yaml@4.1.0";

const SAMPLE = `# 範例：前端／CI 常見結構
name: demo
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
features:
  - preview
  - format
meta:
  version: 1
  nested:
    a: true
    b: 42
`;

const pathLabel = document.getElementById("path-label");
const modeLabel = document.getElementById("mode-label");
const statusEl = document.getElementById("status");
const inputEl = document.getElementById("input");
const outputEl = document.getElementById("output");
const spaceEl = document.getElementById("space");
const btnSave = document.getElementById("btn-save");
const btnReload = document.getElementById("btn-reload");
const btnClose = document.getElementById("btn-close");
const btnSample = document.getElementById("btn-sample");
const btnPretty = document.getElementById("btn-pretty");
const btnCopy = document.getElementById("btn-copy");

/** @type {"standalone" | "tool"} */
let session = "standalone";
let focusPath = "";
let mode = "read";
let contentHash = "";
let dirty = false;

function setStatus(text, tone = "") {
  statusEl.textContent = text || "";
  statusEl.classList.toggle("error", tone === "bad");
  statusEl.classList.toggle("ok", tone === "ok");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || "請求失敗");
    err.code = data.code;
    throw err;
  }
  return data;
}

function syncChrome() {
  pathLabel.textContent = session === "tool" ? focusPath || "—" : "本機試寫";
  modeLabel.textContent = session === "tool" ? mode || "" : "standalone";
  const writable = session === "tool" && mode === "readwrite";
  inputEl.readOnly = session === "tool" && !writable;
  btnSave.hidden = session !== "tool";
  btnClose.hidden = session !== "tool";
  btnSample.hidden = session === "tool";
  btnSave.disabled = !writable || !dirty || !focusPath;
}

function parseYaml(text) {
  try {
    return { ok: true, value: jsyaml.load(text) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function dumpYaml(value, indent) {
  return jsyaml.dump(value, {
    indent,
    lineWidth: 100,
    noRefs: true,
    sortingKeys: false,
  });
}

function runPretty({ writeBack = false } = {}) {
  const text = inputEl.value;
  if (!text.trim()) {
    outputEl.value = "";
    setStatus("待命");
    return false;
  }
  const parsed = parseYaml(text);
  if (!parsed.ok) {
    outputEl.value = "";
    setStatus(parsed.error, "bad");
    return false;
  }
  const indent = Number(spaceEl.value) || 2;
  const pretty = dumpYaml(parsed.value, indent);
  outputEl.value = pretty;
  if (writeBack) {
    if (session === "tool" && mode !== "readwrite") {
      setStatus("唯讀：已輸出，未回寫輸入", "ok");
      return true;
    }
    if (inputEl.value !== pretty) {
      inputEl.value = pretty;
      if (session === "tool") {
        dirty = true;
        syncChrome();
      }
    }
  }
  setStatus("YAML 有效 · 已整形", "ok");
  return true;
}

async function loadGrantAndFile() {
  setStatus("載入授權…");
  const grant = await api("/api/tool/grant");
  session = "tool";
  mode = grant.mode || "read";
  focusPath =
    grant.focusPath ||
    (Array.isArray(grant.paths) && grant.paths[0]) ||
    "";
  syncChrome();
  if (!focusPath) {
    inputEl.value = "";
    outputEl.value = "";
    setStatus("沒有 focusPath；請在遊樂場指定授權路徑後重新掛載", "bad");
    return;
  }
  setStatus("載入檔案…");
  const file = await api(
    "/api/tool/file?" + new URLSearchParams({ path: focusPath })
  );
  inputEl.value = file.content ?? "";
  contentHash = file.hash || "";
  dirty = false;
  syncChrome();
  runPretty();
}

async function save() {
  if (session !== "tool" || !focusPath || mode !== "readwrite") return;
  setStatus("儲存中…");
  btnSave.disabled = true;
  try {
    const body = { path: focusPath, content: inputEl.value };
    if (contentHash) body.expectedHash = contentHash;
    const result = await api("/api/tool/file", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    contentHash = result.hash || "";
    dirty = false;
    syncChrome();
    setStatus("已儲存", "ok");
  } catch (e) {
    setStatus(e instanceof Error ? e.message : String(e), "bad");
    syncChrome();
  }
}

function bootStandalone(seed = SAMPLE) {
  session = "standalone";
  focusPath = "";
  mode = "readwrite";
  contentHash = "";
  dirty = false;
  inputEl.value = seed;
  syncChrome();
  runPretty();
}

inputEl.addEventListener("input", () => {
  if (session === "tool" && mode !== "readwrite") return;
  if (session === "tool") {
    dirty = true;
    syncChrome();
  }
  const parsed = parseYaml(inputEl.value);
  if (!inputEl.value.trim()) {
    setStatus("待命");
    return;
  }
  setStatus(parsed.ok ? "YAML 有效" : parsed.error, parsed.ok ? "ok" : "bad");
});

btnPretty.addEventListener("click", () => {
  runPretty({ writeBack: true });
});

btnCopy.addEventListener("click", async () => {
  const text = outputEl.value || inputEl.value;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("已複製", "ok");
  } catch {
    setStatus("無法寫入剪貼簿", "bad");
  }
});

btnReload.addEventListener("click", () => {
  if (session === "tool") {
    void loadGrantAndFile().catch((e) =>
      setStatus(e instanceof Error ? e.message : String(e), "bad")
    );
  } else {
    runPretty();
  }
});

btnSave.addEventListener("click", () => {
  void save();
});

btnClose.addEventListener("click", () => {
  void api("/api/tool/close", {
    method: "POST",
    body: JSON.stringify({ dirty }),
  })
    .then(() => setStatus("已請求關閉"))
    .catch((e) =>
      setStatus(e instanceof Error ? e.message : String(e), "bad")
    );
});

btnSample.addEventListener("click", () => {
  bootStandalone(SAMPLE);
});

void loadGrantAndFile().catch((e) => {
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  const msg = e instanceof Error ? e.message : String(e);
  const standaloneHint =
    code === "tool_inactive" ||
    code === "not_found" ||
    /env\.TOOL|工具|Not Found|404/i.test(msg);
  bootStandalone();
  if (standaloneHint) {
    setStatus("standalone：可貼上 YAML；掛成工具後可開工作沙盒的 .yml／.yaml");
    return;
  }
  setStatus(
    msg + "（已改本機試寫；要用工具請從遊樂場「用沙盒開啟」掛載）",
    "bad"
  );
});
