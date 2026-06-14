// --- State ---
let uploadedFiles = [];  // [{name, content}] from file upload tab
let folderFiles = [];    // [{name, content}] from folder tab
let lastPayload = null;  // last {doc_type, files} payload for download reuse

// --- Tab switching ---
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const panel = document.getElementById("tab-" + btn.dataset.tab);
    if (panel) panel.classList.add("active");
  });
});

// --- File Upload tab ---
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const uploadFileList = document.getElementById("upload-file-list");

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const xmlFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".xml"));
  loadFileObjects(xmlFiles, "upload");
});

fileInput.addEventListener("change", () => {
  loadFileObjects(Array.from(fileInput.files), "upload");
  fileInput.value = "";
});

// --- Folder tab ---
document.getElementById("folder-btn").addEventListener("click", () => {
  document.getElementById("folder-input").click();
});

document.getElementById("folder-input").addEventListener("change", function () {
  const xmlFiles = Array.from(this.files).filter(f => f.name.endsWith(".xml"));
  loadFileObjects(xmlFiles, "folder");
  const folderLabel = document.getElementById("folder-label");
  if (xmlFiles.length) {
    folderLabel.textContent = xmlFiles.length + " XML file(s) found";
  } else {
    folderLabel.textContent = "No XML files found in folder";
  }
});

// --- Read File objects into [{name, content}] ---
function loadFileObjects(files, target) {
  if (!files.length) return;

  const results = new Array(files.length);
  let pending = files.length;

  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = e => {
      results[idx] = { name: file.name, content: e.target.result };
      pending--;
      if (pending === 0) {
        if (target === "upload") {
          uploadedFiles = results;
          renderChips(uploadFileList, uploadedFiles);
        } else {
          folderFiles = results;
          renderChips(document.getElementById("folder-file-list"), folderFiles);
        }
      }
    };
    reader.onerror = () => {
      pending--;
      if (pending === 0) {
        if (target === "upload") {
          uploadedFiles = results.filter(Boolean);
          renderChips(uploadFileList, uploadedFiles);
        } else {
          folderFiles = results.filter(Boolean);
          renderChips(document.getElementById("folder-file-list"), folderFiles);
        }
      }
    };
    reader.readAsText(file);
  });
}

function renderChips(container, files) {
  container.innerHTML = files
    .map(f => `<span class="file-chip">&#128196; ${escHtml(f.name)}</span>`)
    .join("");
}

// --- Collect input based on active tab ---
function collectInput() {
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

// --- Validate button ---
document.getElementById("validate-btn").addEventListener("click", async () => {
  const errorMsg = document.getElementById("error-msg");
  errorMsg.textContent = "";

  const files = collectInput();
  if (!files) {
    errorMsg.textContent = "Please provide at least one XML input.";
    return;
  }

  const docType = document.getElementById("doc-type").value;
  const payload = { doc_type: docType, files };

  setLoading(true);
  hideResults();

  try {
    const res = await fetch("/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch (_) {}
      throw new Error(detail);
    }

    const data = await res.json();
    lastPayload = payload;
    renderResults(data.results || []);
  } catch (e) {
    errorMsg.textContent = "Validation error: " + e.message;
  } finally {
    setLoading(false);
  }
});

// --- Download report button ---
document.getElementById("download-btn").addEventListener("click", async () => {
  if (!lastPayload) return;
  const errorMsg = document.getElementById("error-msg");
  errorMsg.textContent = "";
  setLoading(true);

  try {
    const res = await fetch("/download-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lastPayload),
    });

    if (!res.ok) throw new Error(res.statusText);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "validation_report.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    errorMsg.textContent = "Download error: " + e.message;
  } finally {
    setLoading(false);
  }
});

// --- Render results ---
function renderResults(results) {
  const total = results.length;
  const passed = results.filter(r => r.status === "pass").length;
  const failed = total - passed;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-passed").textContent = passed;
  document.getElementById("stat-failed").textContent = failed;

  const list = document.getElementById("results-list");
  list.innerHTML = results.map((r, i) => buildResultCard(r, i)).join("");

  // Wire up accordion toggles
  list.querySelectorAll(".result-card-header").forEach(header => {
    header.addEventListener("click", () => {
      const body = header.nextElementSibling;
      const chevron = header.querySelector(".chevron");
      if (body) body.classList.toggle("open");
      if (chevron) chevron.classList.toggle("open");
    });
  });

  // Auto-open failed cards
  list.querySelectorAll(".result-card.status-fail .result-card-body").forEach(body => {
    body.classList.add("open");
    const chevron = body.previousElementSibling.querySelector(".chevron");
    if (chevron) chevron.classList.add("open");
  });

  showResults();
}

function buildResultCard(result, idx) {
  const isPassed = result.status === "pass";
  const statusClass = isPassed ? "status-pass" : "status-fail";
  const badgeClass = isPassed ? "badge-pass" : "badge-fail";
  const badgeText = isPassed ? "PASS" : "FAIL";
  const errors = result.errors || [];
  const errorCount = errors.length;

  let bodyContent;
  if (isPassed) {
    bodyContent = `<p class="no-errors">&#10003; No issues found</p>`;
  } else {
    const rows = errors.map(e => `
      <tr class="sev-${escHtml(e.severity || 'error')}">
        <td>${escHtml(e.field || "")}</td>
        <td>${escHtml(e.rule || "")}</td>
        <td>${escHtml(e.message || "")}</td>
        <td>${e.line != null ? escHtml(String(e.line)) : "—"}</td>
        <td>${escHtml(e.severity || "")}</td>
      </tr>`).join("");

    bodyContent = `
      <table class="error-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Rule</th>
            <th>Message</th>
            <th>Line</th>
            <th>Severity</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const countLabel = !isPassed
    ? `<span class="error-count-label">(${errorCount} issue${errorCount !== 1 ? "s" : ""})</span>`
    : "";

  return `
    <div class="result-card ${statusClass}">
      <div class="result-card-header">
        <div class="file-info">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="filename">${escHtml(result.filename || "")}</span>
          ${countLabel}
        </div>
        <i class="chevron">&#9660;</i>
      </div>
      <div class="result-card-body">${bodyContent}</div>
    </div>`;
}

// --- Helpers ---
function setLoading(on) {
  const spinner = document.getElementById("spinner");
  const btn = document.getElementById("validate-btn");
  spinner.classList.toggle("visible", on);
  btn.disabled = on;
}

function showResults() {
  document.getElementById("results-section").classList.add("visible");
}

function hideResults() {
  document.getElementById("results-section").classList.remove("visible");
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
