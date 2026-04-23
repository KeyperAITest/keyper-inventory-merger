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
// MAIN ENTRY
// ==================================================
function handleAnalyze() {
  const files = document.getElementById("fileInput")?.files;

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

  Array.from(files).forEach(parseFile);
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
// NORMALIZATION + REQUIRED FIELD ENFORCEMENT
// ==================================================
function handleParsedRows(file, rows) {
  rows.forEach(row => {
    const name = row["Name"] || row["name"] || "";
    const fob =
      row["Fob Number"] ||
      row["fob_number"] ||
      row["FobNumber"] ||
      row["fob"] ||
      "";

    // ✅ REQUIRED: Name + Fob Number
    if (!name || !fob) return;

    combinedRows.push({
      sourceFile: file.name,
      name: name.toString().trim(),
      make: row["Make"] || row["Make_att"] || "",
      model: row["Model"] || row["Model_att"] || "",
      year: row["Year"] || row["Year_att"] || "",
      extColor: row["Ext Color"] || row["Ext. Color_att"] || "",
      code: row["Code"] || "",
      intColor: row["Int Color"] || row["Int. Color_att"] || "",
      vin: row["VIN"] || row["VIN_att"] || "",
      fob: fob.toString().trim()
    });
  });

  markFileComplete();
}

// ==================================================
// INGESTION COMPLETE
// ==================================================
function markFileComplete() {
  filesProcessed++;
  const total = document.getElementById("fileInput").files.length;
  if (filesProcessed >= total) processDuplicates();
}

// ==================================================
// DUPLICATE FOB FILTERING
// ==================================================
function processDuplicates() {
  combinedRows.forEach(r => {
    if (!fobGroups[r.fob]) fobGroups[r.fob] = [];
    fobGroups[r.fob].push(r);
  });

  Object.keys(fobGroups).forEach(fob => {
    const group = fobGroups[fob];

    if (group.length === 1) {
      cleanRows.push(group[0]);
    } else {
      duplicateSummary.push({
        fob,
        sources: [...new Set(group.map(r => r.sourceFile))],
        assetNames: group.map(r => r.name)
      });
    }
  });

  finalizeStatus();
}

// ==================================================
// STATUS
// ==================================================
function finalizeStatus() {
  showStatus(
    `✅ Files processed: ${filesProcessed}<br>
     📦 Total records scanned: ${combinedRows.length}<br>
     ✅ Included (unique fobs): ${cleanRows.length}<br>
     ❌ Skipped (duplicate fobs): ${
       duplicateSummary.reduce((sum, d) => sum + d.assetNames.length, 0)
     }<br>
     ⚠️ Duplicate fob numbers: ${duplicateSummary.length}`,
    "success"
  );

  document.getElementById("exportCleanBtn").disabled =
    cleanRows.length === 0;
  document.getElementById("exportSummaryBtn").disabled =
    duplicateSummary.length === 0;
}

// ==================================================
// EXPORT: CLEAN INVENTORY (SCHEMA PARITY)
// ==================================================
function exportCleanInventory() {
  const output = [[
    "Name",
    "Make",
    "Model",
    "Year",
    "Ext Color",
    "Code",
    "Int Color",
    "VIN",
    "Fob Number"
  ]];

  cleanRows.forEach(r => {
    output.push([
      r.name,
      r.make,
      r.model,
      r.year,
      r.extColor,
      r.code,
      r.intColor,
      r.vin,
      r.fob
    ]);
  });

  downloadCSV(output, "import_ready_inventory_with_fob.csv");
}

// ==================================================
// EXPORT: DUPLICATE FOB SUMMARY (ASSET-FIRST)
// ==================================================
function exportDuplicateSummary() {
  if (duplicateSummary.length === 0) return;

  const maxAssets = Math.max(
    ...duplicateSummary.map(d => d.assetNames.length)
  );

  const header = [];
  for (let i = 0; i < maxAssets; i++) {
    header.push(`Asset Name ${i + 1}`);
  }
  header.push("Fob Number", "Source Files");

  const output = [header];

  duplicateSummary.forEach(d => {
    const row = [...d.assetNames];
    while (row.length < maxAssets) row.push("");
    row.push(d.fob);
    row.push(d.sources.join(" | "));
    output.push(row);
  });

  downloadCSV(output, "duplicate_fob_summary.csv");
}

// ==================================================
// UTILITIES
// ==================================================
function downloadCSV(data, filename) {
  const blob = new Blob([Papa.unparse(data)], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function showStatus(msg, type) {
  document.getElementById("statusArea").innerHTML =
    `<p class="${type}">${msg}</p>`;
}
