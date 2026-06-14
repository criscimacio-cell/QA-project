/* ── State ──────────────────────────────────────────────────────────────────── */
let uploadedFiles = [];   // Array of {name, content} from "Upload Files" tab
let folderFiles   = [];   // Array of {name, content} from "Upload Folder" tab
let lastPayload   = null; // Most recent request payload — reused for download

/* ── Tab switching ──────────────────────────────────────────────────────────── */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const panelId = "panel-" + btn.dataset.tab;
    document.getElementById(panelId).classList.add("active");
  });
});

/* ── Upload Files tab ──────────────────────────────────────────────────────── */
const dropZone  = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileList  = document.getElementById("fileList");

// Click anywhere on the drop zone to open file picker
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const xmlFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".xml"));
  readFiles(xmlFiles).then(results => {
    uploadedFiles = results;
    renderFileChips(fileList, uploadedFiles);
  });
});

fileInput.addEventListener("change", () => {
  readFiles(Array.from(fileInput.files)).then(results => {
    uploadedFiles = results;
    renderFileChips(fileList, uploadedFiles);
  });
  fileInput.value = ""; // allow re-selecting same files
});

/* ── Upload Folder tab ─────────────────────────────────────────────────────── */
const folderInput    = document.getElementById("folderInput");
const chooseFolderBtn = document.getElementById("chooseFolderBtn");
const folderFileList = document.getElementById("folderFileList");

chooseFolderBtn.addEventListener("click", () => folderInput.click());

folderInput.addEventListener("change", function () {
  const xmlFiles = Array.from(this.files).filter(f => f.name.endsWith(".xml"));
  readFiles(xmlFiles).then(results => {
    folderFiles = results;
    renderFileChips(folderFileList, folderFiles);
  });
});

/* ── Validate button ────────────────────────────────────────────────────────── */
document.getElementById("validateBtn").addEventListener("click", async () => {
  clearError();

  const files = collectFiles();
  if (!files) {
    showError("Please provide at least one XML input.");
    return;
  }

  const docType = document.getElementById("docType").value;
  const payload = { doc_type: docType, files };

  setLoading(true);
  try {
    const res = await fetch("/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(body.detail || res.statusText);
    }
    const data = await res.json();
    lastPayload = payload;
    renderResults(data);
  } catch (err) {
    showError("Validation failed: " + err.message);
  } finally {
    setLoading(false);
  }
});

/* ── Download Report button ─────────────────────────────────────────────────── */
document.getElementById("downloadBtn").addEventListener("click", async () => {
  if (!lastPayload) return;
  clearError();
  setLoading(true);
  try {
    const res = await fetch("/download-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lastPayload),
    });
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "validation_report.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    showError("Download failed: " + err.message);
  } finally {
    setLoading(false);
  }
});

/* ── renderResults ──────────────────────────────────────────────────────────── */
function renderResults(data) {
  const results = data.results || [];

  // Update summary counts
  const total   = results.length;
  const passed  = results.filter(r => r.status === "pass").length;
  const failed  = results.filter(r => r.status === "fail").length;

  document.getElementById("totalCount").textContent = total;
  document.getElementById("passCount").textContent  = passed;
  document.getElementById("failCount").textContent  = failed;

  // Build result cards
  const container = document.getElementById("resultsContainer");
  container.innerHTML = results.map(buildCard).join("");

  // Wire up accordion toggles
  container.querySelectorAll(".result-card-header").forEach(header => {
    header.addEventListener("click", () => {
      const body    = header.nextElementSibling;
      const chevron = header.querySelector(".chevron");
      const isOpen  = body.classList.toggle("open");
      chevron.classList.toggle("open", isOpen);
    });
  });

  // Show results section
  document.getElementById("resultsSection").style.display = "flex";
}

/* ── buildCard ──────────────────────────────────────────────────────────────── */
function buildCard(result) {
  const isPass     = result.status === "pass";
  const statusCls  = isPass ? "pass" : "fail";
  const badgeCls   = isPass ? "badge-pass" : "badge-fail";
  const badgeText  = isPass ? "PASS" : "FAIL";
  const errors     = result.errors || [];
  const issueCount = errors.length;

  // Body content
  let bodyHtml;
  if (isPass) {
    bodyHtml = `<p class="no-errors">&#10003; No issues found</p>`;
  } else {
    const items = errors.map(e => {
      const sevCls  = "sev-" + (e.severity || "error");
      const lineStr = e.line != null ? `Line ${e.line}` : "";
      return `
        <div class="error-item ${sevCls}">
          <div class="error-item-header">
            <span class="error-field">${esc(e.field || "")}</span>
            <span class="error-rule">${esc(e.rule || "")}</span>
            ${lineStr ? `<span class="error-line">${esc(lineStr)}</span>` : ""}
            <span class="sev-badge ${sevCls}">${esc(e.severity || "error")}</span>
          </div>
          <div class="error-message">${esc(e.message || "")}</div>
        </div>`;
    }).join("");
    bodyHtml = `<div class="error-list">${items}</div>`;
  }

  const issueSuffix = issueCount === 1 ? "issue" : "issues";
  const issueLabel  = !isPass && issueCount > 0
    ? `<span class="issue-count">(${issueCount} ${issueSuffix})</span>`
    : "";

  return `
    <div class="result-card ${statusCls}">
      <div class="result-card-header">
        <div class="file-info">
          <span class="badge ${badgeCls}">${badgeText}</span>
          <span class="filename">${esc(result.filename || "")}</span>
          ${issueLabel}
        </div>
        <i class="chevron">&#9660;</i>
      </div>
      <div class="result-card-body">${bodyHtml}</div>
    </div>`;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

/**
 * Read an array of File objects as text.
 * Returns Promise<Array<{name, content}>>
 */
function readFiles(files) {
  if (!files.length) return Promise.resolve([]);
  return Promise.all(
    files.map(
      file =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = e => resolve({ name: file.name, content: e.target.result });
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsText(file);
        })
    )
  );
}

/** Render file chips in a container element. */
function renderFileChips(container, files) {
  container.innerHTML = files
    .map(f => `<span class="file-chip">&#128196; ${esc(f.name)}</span>`)
    .join("");
}

/** Return the list of {name, content} objects for the currently active tab,
 *  or null if there is nothing to validate. */
function collectFiles() {
  const activeTab = document.querySelector(".tab-btn.active").dataset.tab;

  if (activeTab === "paste") {
    const content = document.getElementById("xmlInput").value.trim();
    if (!content) return null;
    return [{ name: "input.xml", content }];
  }

  if (activeTab === "upload") {
    return uploadedFiles.length ? uploadedFiles : null;
  }

  if (activeTab === "folder") {
    return folderFiles.length ? folderFiles : null;
  }

  return null;
}

/** Show/hide the loading overlay and disable the validate button. */
function setLoading(on) {
  document.getElementById("loading").style.display     = on ? "flex" : "none";
  document.getElementById("validateBtn").disabled      = on;
}

/** Show a user-facing error message. */
function showError(msg) {
  document.getElementById("errorMsg").textContent = msg;
}

/** Clear the error message. */
function clearError() {
  document.getElementById("errorMsg").textContent = "";
}

/** HTML-escape a string to prevent XSS when inserting into innerHTML. */
function esc(str) {
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}
