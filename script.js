console.log("✅ Duplicate Fob Filter script loaded");
// ==================================================
// GLOBAL STATE
// ==================================================
let combinedRows = [];
let filesProcessed = 0;

let fobGroups = {};
let cleanRows = [];
let duplicateSummary = [];

// ==================================================
// EVENT WIRING
// ==================================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn")
    ?.addEventListener("click", handleAnalyze);

  document.getElementById("exportCleanBtn")
    ?.addEventListener("click", exportCleanInventory);

  document.getElementById("exportSummaryBtn")
    ?.addEventListener("click", exportDuplicateSummary);
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
  cleanRows = [];
  duplicateSummary = [];

  document.getElementById("exportCleanBtn").disabled = true;
  document.getElementById("exportSummaryBtn").disabled = true;

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
      complete: r => handleParsedRows(file, r.data)
    });
  } else if (ext === "xls" || ext === "xlsx") {
    parseExcelFile(file);
  } else {
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
    markFileComplete();
    return;
  }

  const headers = rows[0].map(h =>
    h ? h.toString().toLowerCase().trim() : ""
  );

  const fobIndex = headers.findIndex(h =>
    h === "fob_number" || h === "fob" || h === "fobnumber"
  );

  if (fobIndex === -1) {
    markFileComplete();
    return;
  }

  rows.slice(1).forEach(row => {
    const fobVal = row[fobIndex];
    if (!fobVal) return;

    combinedRows.push({
      sourceFile: file.name,
      fob: fobVal.toString().trim(),
      row
    });
  });

  markFileComplete();
}

// ==================================================
// INGESTION COMPLETE
// ==================================================
function markFileComplete() {
  filesProcessed++;
  const totalFiles =
    document.getElementById("fileInput").files.length;

  if (filesProcessed >= totalFiles) {
    processDuplicates();
  }
}

// ==================================================
// DUPLICATE PROCESSING (NEW BEHAVIOR)
// ==================================================
function processDuplicates() {
  // Group by fob
  combinedRows.forEach(r => {
    if (!fobGroups[r.fob]) fobGroups[r.fob] = [];
    fobGroups[r.fob].push(r);
  });

  Object.keys(fobGroups).forEach(fob => {
    const group = fobGroups[fob];

    if (group.length === 1) {
      // ✅ Valid, unique fob
      cleanRows.push(group[0]);
    } else {
      // ❌ Duplicate → exclude ALL
      const sources = [...new Set(
        group.map(r => r.sourceFile)
      )];

      duplicateSummary.push({
        fob,
        occurrences: group.length,
        sources
      });
    }
  });

  finalizeStatus();
}

// ==================================================
// STATUS + ENABLE EXPORTS
// ==================================================
function finalizeStatus() {
  const total = combinedRows.length;
  const accepted = cleanRows.length;
  const skipped = duplicateSummary.reduce(
    (sum, d) => sum + d.occurrences, 0
  );

  showStatus(
    `✅ Files processed: ${filesProcessed}<br>
     📦 Total records scanned: ${total}<br>
     ✅ Included (unique fobs): ${accepted}<br>
     ❌ Skipped (duplicate fobs): ${skipped}<br>
     ⚠️ Duplicate fob numbers: ${duplicateSummary.length}`,
    "success"
  );

  document.getElementById("exportCleanBtn").disabled = accepted === 0;
  document.getElementById("exportSummaryBtn").disabled =
    duplicateSummary.length === 0;
}

// ==================================================
// EXPORT: CLEAN INVENTORY
// ==================================================
function exportCleanInventory() {
  if (cleanRows.length === 0) return;

  const output = [];
  output.push(cleanRows[0].row.map((_, i) => `Column${i+1}`));

  cleanRows.forEach(r => output.push(r.row));

  downloadCSV(output, "combined_inventory_clean.csv");
}

// ==================================================
// EXPORT: DUPLICATE SUMMARY
// ==================================================
function exportDuplicateSummary() {
  if (duplicateSummary.length === 0) return;

  const output = [
    ["FobNumber", "Occurrences", "SourceFiles"]
  ];

  duplicateSummary.forEach(d => {
    output.push([
      d.fob,
      d.occurrences,
      d.sources.join(" | ")
    ]);
  });

  downloadCSV(output, "duplicate_fob_summary.csv");
}

// ==================================================
// CSV DOWNLOAD HELPER
// ==================================================
function downloadCSV(data, filename) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// ==================================================
// STATUS DISPLAY
// ==================================================
function showStatus(message, type) {
  const area = document.getElementById("statusArea");
  if (!area) return;
  area.innerHTML = `<p class="${type}">${message}</p>`;
}
