// ==================================================
// GLOBAL STATE
// ==================================================
let combinedRows = [];
let filesProcessed = 0;

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

    const sheet =
      workbook.Sheets[workbook.SheetNames[0]];

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
// INGESTION COMPLETE
// ==================================================
function ingestionComplete() {
  const uniqueFobs = new Set(
    combinedRows.map(r => r.fob)
  );

  console.log("✅ Ingestion complete");
  console.log("Total rows loaded:", combinedRows.length);
  console.log("Unique fob numbers:", uniqueFobs.size);
  console.log("Combined rows:", combinedRows);

  showStatus(
    `✅ Loaded ${combinedRows.length} records from ${filesProcessed} files.<br>
     🔑 Unique Fobs: ${uniqueFobs.size}`,
    "success"
  );
}

// ==================================================
// STATUS DISPLAY
// ==================================================
function showStatus(message, type) {
  const area = document.getElementById("statusArea");
  if (!area) return;

  area.innerHTML = `<p class="${type}">${message}</p>`;
}
