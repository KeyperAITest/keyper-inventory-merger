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

  showStatus(`🔄 Analyzing ${files.length} file(s)...`, "info");

  Array.from(files).forEach(file => parseFile(file));
}

// ==================================================
// FILE PARSING (CSV + EXCEL)
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

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: ""
    });

    handleParsedRows(file, rows);
  };

  reader.readAsArrayBuffer(file);
}

// ==================================================
// NORMALIZE ROWS
// ==================================================
function handleParsedRows(file, rows) {
  rows.forEach(row => {
    const fob =
      row["fob_number"] ||
      row["Fob Number"] ||
      row["FobNumber"] ||
      row["fob"];

    if (!fob) return;

    combinedRows.push({
      sourceFile: file.name,
      fob: fob.toString().trim(),
      name: row["name"] || row["Name"] || "",
      make: row["Make"] || row["Make_att"] || "",
      model: row["Model"] || row["Model_att"] || "",
      year: row["Year"] || row["Year_att"] || "",
      extColor: row["Ext Color"] || row["Ext. Color_att"] || "",
      intColor: row["Int Color"] || row["Int. Color_att"] || "",
      vin: row["VIN"] || row["VIN_att"] || ""
    });
  });

  markFileComplete();
}

// ==================================================
// INGESTION COMPLETE
// ==================================================
function markFileComplete() {
  filesProcessed++;
  const total =
    document.getElementById("fileInput").files.length;

  if (filesProcessed >= total) {
    processDuplicates();
  }
}

// ==================================================
// DUPLICATE FILTERING (FINAL LOGIC)
// ==================================================
function processDuplicates() {
  // Group by fob number
  combinedRows.forEach(r => {
    if (!fobGroups[r.fob]) fobGroups[r.fob] = [];
    fobGroups[r.fob].push(r);
  });

  Object.keys(fobGroups).forEach(fob => {
    const group = fobGroups[fob];

    if (group.length === 1) {
      // ✅ Keep unique fobs
      cleanRows.push(group[0]);
    } else {
      // ❌ Remove all duplicates
      const sources = [...new Set(group.map(r => r.sourceFile))];
      const assetNames = group
        .map(r => r.name)
        .filter(v => v && v.trim() !== "");

      duplicateSummary.push({
        fob,
        occurrences: group.length,
        sources,
        assetNames
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
  const kept = cleanRows.length;
  const skipped = duplicateSummary.reduce(
    (sum, d) => sum + d.occurrences,
    0
  );

  showStatus(
    `✅ Files processed: ${filesProcessed}<br>
     📦 Total records scanned: ${total}<br>
     ✅ Included (unique fobs): ${kept}<br>
     ❌ Skipped (duplicate fobs): ${skipped}<br>
     ⚠️ Duplicate fob numbers: ${duplicateSummary.length}`,
    "success"
  );

  document.getElementById("exportCleanBtn").disabled = kept === 0;
  document.getElementById("exportSummaryBtn").disabled =
    duplicateSummary.length === 0;
}

// ==================================================
// EXPORT: CLEAN INVENTORY (WITH HEADERS)
// ==================================================
function exportCleanInventory() {
  if (cleanRows.length === 0) return;

  const output = [];

  // ✅ REQUIRED HEADER ORDER
  output.push([
    "Name",
    "Make",
    "Model",
    "Year",
    "Ext Color",
    "Int Color",
    "VIN",
    "Fob Number"
  ]);

  cleanRows.forEach(r => {
    output.push([
      r.name,
      r.make,
      r.model,
      r.year,
      r.extColor,
      r.intColor,
      r.vin,
      r.fob
    ]);
  });

  downloadCSV(output, "combined_inventory_clean.csv");
}

// ==================================================
// EXPORT: DUPLICATE FOB SUMMARY
// ==================================================
function exportDuplicateSummary() {
  if (duplicateSummary.length === 0) return;

  const output = [
    ["FobNumber", "Occurrences", "SourceFiles", "AssetNames"]
  ];

  duplicateSummary.forEach(d => {
    output.push([
      d.fob,
      d.occurrences,
      d.sources.join(" | "),
      d.assetNames.join(" | ")
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
``
