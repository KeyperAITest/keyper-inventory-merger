// ==================================================
// GLOBAL STATE
// ==================================================
let combinedRows = [];
let filesProcessed = 0;

let fobGroups = {};
let duplicateFobGroups = [];
let uniqueFobRows = [];

// ==================================================
// EVENT WIRING
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", handleAnalyze);
  }
});

// ==================================================
// MAIN ENTRY POINT
// ==================================================
function handleAnalyze() {
  const input = document.getElementById("fileInput");
  const files = input?.files;

  if (!files || files.length === 0) {
    showStatus("❌ Please select at least one file.", "error");
    return;
  }

  combinedRows = [];
  filesProcessed = 0;
  fobGroups = {};
  duplicateFobGroups = [];
  uniqueFobRows = [];

  showStatus(`🔄 Processing ${files.length} files...`, "info");

  Array.from(files).forEach(file => parseFile(file));
}

// ==================================================
// FILE PARSING (CSV + EXCEL)
// ==================================================
function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "csv") {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: result => handleParsedRows(file, result.data)
    });
  }
  else if (ext === "xls" || ext === "xlsx") {
    parseExcelFile(file);
  }
  else {
    console.warn("Unsupported file type:", file.name);
    markFileComplete();
  }
}

function parseExcelFile(file) {
  const reader = new FileReader();

  reader.onload = e => {
    const workbook = XLSX.read(
      new Uint8Array(e.target.result),
      { type: "array" }
    );

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false
    });

    handleParsedRows(file, rows);
  };

  reader.readAsArrayBuffer(file);
}

// ==================================================
// ROW NORMALIZATION
// ==================================================
function handleParsedRows(file, rows) {
  if (!rows || rows.length < 2) {
    console.warn("No usable rows in", file.name);
    markFileComplete();
    return;
  }

  // Normalize headers
  const headers = rows[0].map(h =>
    h ? h.toString().toLowerCase().trim() : ""
  );

  // Locate fob column (flexible matching)
  const fobIndex = headers.findIndex(h =>
    h === "fob_number" || h === "fob" || h === "fobnumber"
  );

  if (fobIndex === -1) {
    console.warn("No fob column found in", file.name);
    markFileComplete();
    return;
  }

  // Process data rows
  rows.slice(1).forEach(row => {
    const fobValue = row[fobIndex];
    if (!fobValue) return;

    combinedRows.push({
      sourceFile: file.name,
      fob: fobValue.toString().trim(),
      row: row,
      approved: false,
      rejected: false
    });
  });

  markFileComplete();
}

// ==================================================
// FILE COMPLETION TRACKING
// ==================================================
function markFileComplete() {
  filesProcessed++;

  const totalFiles =
    document.getElementById("fileInput").files.length;

  if (filesProcessed >= totalFiles) {
    ingestionComplete();
  }
}

// ==================================================
// INGESTION COMPLETE → PHASE 2 ENTRY
// ==================================================
function ingestionComplete() {
  const uniqueFobs = new Set(combinedRows.map(r => r.fob));

  console.log("✅ Ingestion complete");
  console.log("Total rows loaded:", combinedRows.length);
  console.log("Unique fob numbers:", uniqueFobs.size);

  // ---- PHASE 2 ----
  groupRowsByFob();
  analyzeFobGroups();

  showStatus(
    `✅ Loaded ${combinedRows.length} records from ${filesProcessed} files.<br>
     🔑 Unique Fobs: ${uniqueFobs.size}<br>
     ⚠️ Duplicate Fobs: ${duplicateFobGroups.length}`,
    "success"
  );
}

// ==================================================
// PHASE 2: GROUP BY FOB
// ==================================================
function groupRowsByFob() {
  fobGroups = {};

  combinedRows.forEach(record => {
    if (!fobGroups[record.fob]) {
      fobGroups[record.fob] = [];
    }
    fobGroups[record.fob].push(record);
  });

  console.log("📦 Fob groups created:", fobGroups);
}

// ==================================================
// PHASE 2: ANALYZE GROUPS
// ==================================================
function analyzeFobGroups() {
  duplicateFobGroups = [];
  uniqueFobRows = [];

  Object.keys(fobGroups).forEach(fob => {
    const group = fobGroups[fob];

    if (group.length === 1) {
      // ✅ Safe auto-approval
      group[0].approved = true;
      uniqueFobRows.push(group[0]);
    } else {
      // ⚠️ Requires human resolution later
      duplicateFobGroups.push(group);
    }
  });

  console.log("✅ Auto-approved rows:", uniqueFobRows.length);
  console.log("⚠️ Duplicate fob groups:", duplicateFobGroups.length);
  console.log("Duplicate groups detail:", duplicateFobGroups);
}

// ==================================================
// STATUS DISPLAY
// ==================================================
function showStatus(message, type) {
  const area = document.getElementById("statusArea");
  if (!area) return;

  area.innerHTML = `<p class="${type}">${message}</p>`;
}
