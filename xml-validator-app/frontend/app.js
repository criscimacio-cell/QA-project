// --- State ---
let uploadedFiles = [];   // [{name, content}] from file upload tab
let folderFiles = [];     // [{name, content}] from folder tab
let lastResults = null;
let lastDocType = null;

// --- Tab switching ---
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// --- File Upload tab ---
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const uploadFileList = document.getElementById("upload-file-list");

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  loadFileObjects(Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".xml")), "upload");
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
  folderLabel.textContent = xmlFiles.length
    ? `${xmlFiles.length} XML file(s) found`
    : "No XML files found in folder";
});

function loadFileObjects(files, target) {
  const list = target === "upload" ? [] : [];
  let pending = files.length;
  if (!pending) return;

  const results = [];
  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = e => {
      results[idx] = { name: file.name, content: e.target.result };
      if (--pending === 0) {
        if (target === "upload") {
          uploadedFiles = results;
          renderChips(uploadFileList, uploadedFiles);
        } else {
          folderFiles = results;
          renderChips(document.getElementById("folder-file-list"), folderFiles);
        }
      }
    };
    reader.readAsText(file);
  });
}

function renderChips(container, files) {
  container.innerHTML = files
    .map(f => `<span class="file-chip">📄 ${escHtml(f.name)}</span>`)
    .join("");
}

// --- Collect input based on active tab ---
function collectInput() {
  const activeTab = document.querySelector(".tab-btn.active").dataset.tab;
  if (activeTab === "paste") {
    const content = document.getElementById("xml-paste").value.trim();
    if (!content) return null;
    return [{ name: "pasted-input.xml", content }];
  }
  if (activeTab === "upload") return uploadedFiles.length ? uploadedFiles : null;
  if (activeTab === "folder") return folderFiles.length ? folderFiles : null;
  return null;
}

// --- Validate ---
document.getElementById("validate-btn").addEventListener("click", async () => {
  const files = collectInput();
  const errorMsg = document.getElementById("error-msg");
  if (!files) {
    errorMsg.textContent = "Please provide at least one XML input.";
    return;
  }
  errorMsg.textContent = "";

  const docType = document.getElementById("doc-type").value;
  setLoading(true);

  try {
    const res = await fetch("/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_type: docType, files }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    const data = await res.json();
    const results = data.results || [];
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === "pass").length,
      failed: results.filter(r => r.status === "fail").length,
    };
    lastResults = files;
    lastDocType = docType;
    renderResults({ results, summary });
  } catch (e) {
    errorMsg.textContent = "Error: " + e.message;
  } finally {
    setLoading(false);
  }
});

// --- Download report ---
document.getElementById("download-btn").addEventListener("click", async () => {
  if (!lastResults) return;
  const errorMsg = document.getElementById("error-msg");
  errorMsg.textContent = "";
  setLoading(true);

  try {
    const res = await fetch("/download-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_type: lastDocType, files: lastResults }),
    });
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "validation_report.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    errorMsg.textContent = "Download error: " + e.message;
  } finally {
    setLoading(false);
  }
});

// --- Render results ---
function renderResults(data) {
  const { results, summary } = data;

  document.getElementById("stat-total").textContent = summary.total;
  document.getElementById("stat-passed").textContent = summary.passed;
  document.getElementById("stat-failed").textContent = summary.failed;

  const list = document.getElementById("results-list");
  list.innerHTML = results.map((r, i) => buildResultCard(r, i)).join("");

  // Wire up accordion toggles
  document.querySelectorAll(".result-card-header").forEach(header => {
    header.addEventListener("click", () => {
      const body = header.nextElementSibling;
      const chevron = header.querySelector(".chevron");
      body.classList.toggle("open");
      chevron.classList.toggle("open");
    });
  });

  document.getElementById("results-section").classList.add("visible");
  document.getElementById("download-btn").classList.add("visible");
}

function buildResultCard(result, idx) {
  const isPassed = result.status === "pass";
  const badgeClass = isPassed ? "badge-pass" : "badge-fail";
  const badgeText = isPassed ? "PASS" : "FAIL";
  const errorCount = result.errors.length;

  let bodyContent;
  if (isPassed) {
    bodyContent = `<p class="no-errors">✓ No issues found</p>`;
  } else {
    const rows = result.errors.map(e => `
      <tr class="sev-${e.severity}">
        <td>${escHtml(e.field || "")}</td>
        <td>${escHtml(e.rule || "")}</td>
        <td>${escHtml(e.message || "")}</td>
        <td>${e.line != null ? e.line : "—"}</td>
        <td>${escHtml(e.severity || "")}</td>
      </tr>`).join("");
    bodyContent = `
      <table class="error-table">
        <thead><tr><th>Field</th><th>Rule</th><th>Message</th><th>Line</th><th>Severity</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  return `
    <div class="result-card">
      <div class="result-card-header">
        <div class="file-info">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="filename">${escHtml(result.filename)}</span>
          ${!isPassed ? `<span style="font-size:.8rem;color:var(--gray-400)">(${errorCount} issue${errorCount !== 1 ? "s" : ""})</span>` : ""}
        </div>
        <i class="chevron">▼</i>
      </div>
      <div class="result-card-body">${bodyContent}</div>
    </div>`;
}

// --- Helpers ---
function setLoading(on) {
  document.getElementById("spinner").classList.toggle("visible", on);
  document.getElementById("validate-btn").disabled = on;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
