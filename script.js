// ==================================================
// GLOBAL STATE
// ==================================================
let combinedRows = [];
let filesProcessed = 0;
let selectedFiles = [];

let fobGroups = {};
let cleanRows = [];
let duplicateSummary = [];

// ==================================================
// EVENT WIRING
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const exportCleanBtn = document.getElementById("exportCleanBtn");
  const exportSummaryBtn = document.getElementById("exportSummaryBtn");

  analyzeBtn.disabled = true;
  exportCleanBtn.disabled = true;
  exportSummaryBtn.disabled = true;

  // -----------------------------
  // Click-to-browse support
  // -----------------------------
  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    addFiles([...fileInput.files]);
    fileInput.value = "";
  });

  // -----------------------------
  // Drag & Drop support
  // -----------------------------
  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.style.borderColor = "#0b5aa5";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "#aaa";
  });

  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.style.borderColor = "#aaa";
    addFiles([...e.dataTransfer.files]);
  });

  analyzeBtn.addEventListener("click", handleAnalyze);
  exportCleanBtn.addEventListener("click", exportCleanInventory);
  exportSummaryBtn.addEventListener("click", exportDuplicateSummary);
});

// ==================================================
// FILE MANAGEMENT
// ==================================================
function addFiles(files) {
  files.forEach(f => {
    if (!selectedFiles.some(sf => sf.name === f.name && sf.size === f.size)) {
      selectedFiles.push(f);
    }
  });

  document.getElementById("analyzeBtn").disabled =
    selectedFiles.length === 0;

  showStatus(
    `✅ ${selectedFiles.length} file(s) ready for analysis.`,
    "info"
  );
}

// ==================================================
// ANALYSIS ENTRY
// ==================================================
function handleAnalyze() {
  if (selectedFiles.length === 0) return;

  combinedRows = [];
  filesProcessed = 0;
  fobGroups = {};
  cleanRows = [];
  duplicateSummary = [];

  document.getElementById("exportCleanBtn").disabled = true;
  document.getElementById("exportSummaryBtn").disabled = true;

  showStatus(
    `🔄 Analyzing ${selectedFiles.length} file(s)...`,
    "info"
  );

  selectedFiles.forEach(parseFile);
}

// ==================================================
// FILE PARSING
// ==================================================
function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "csv") {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: r => handleParsedRows(file, r.data)
    });
  } else if (ext === "xls" || ext === "xlsx") {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      handleParsedRows(
        file,
        XLSX.utils.sheet_to_json(sheet, { defval: "" })
      );
    };
    reader.readAsArrayBuffer(file);
  } else {
    markFileComplete();
  }
}

// ==================================================
// NORMALIZATION
// ==================================================
function handleParsedRows(file, rows) {
  rows.forEach(row => {
    const name = row["Name"] || row["name"];
    const fob =
      row["Fob Number"] ||
      row["fob_number"] ||
      row["FobNumber"] ||
      row["fob"];

    if (!name || !fob) return;

    combinedRows.push({
      sourceFile: file.name,
      name: name.toString().trim(),
      make: row["Make"] || "",
      model: row["Model"] || "",
      year: row["Year"] || "",
      extColor: row["Ext Color"] || "",
      code: row["Code"] || "",
      intColor: row["Int Color"] || "",
      vin: row["VIN"] || "",
      fob: fob.toString().trim()
    });
  });

  markFileComplete();
}

// ==================================================
// DUPLICATE PROCESSING
// ==================================================
function markFileComplete() {
  filesProcessed++;
  if (filesProcessed >= selectedFiles.length) processDuplicates();
}

function processDuplicates() {
  combinedRows.forEach(r => {
    if (!fobGroups[r.fob]) fobGroups[r.fob] = [];
    fobGroups[r.fob].push(r);
  });

  Object.values(fobGroups).forEach(group => {
    if (group.length === 1) {
      cleanRows.push(group[0]);
    } else {
      duplicateSummary.push({
        fob: group[0].fob,
        sources: [...new Set(group.map(r => r.sourceFile))],
        assetNames: group.map(r => r.name)
      });
    }
  });

  finalizeStatus();
}

// ==================================================
// STATUS + EXPORT ENABLE
// ==================================================
function finalizeStatus() {
  showStatus(
    `✅ Files processed: ${selectedFiles.length}<br>
     📦 Records scanned: ${combinedRows.length}<br>
     ✅ Included: ${cleanRows.length}<br>
     ❌ Skipped duplicates: ${
       duplicateSummary.reduce(
         (s, d) => s + d.assetNames.length,
         0
       )
     }`,
    "success"
  );

  document.getElementById("exportCleanBtn").disabled =
    cleanRows.length === 0;
  document.getElementById("exportSummaryBtn").disabled =
    duplicateSummary.length === 0;
}

// ==================================================
// EXPORTS (UNCHANGED)
// ==================================================
function exportCleanInventory() { /* unchanged from your current version */ }
function exportDuplicateSummary() { /* unchanged */ }

// ==================================================
// UTIL
// ==================================================
function showStatus(msg, type) {
  document.getElementById("statusArea").innerHTML =
    `<p class="${type}">${msg}</p>`;
}
