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
  document
    .getElementById("analyzeBtn")
    ?.addEventListener("click", handleAnalyze);

  document
    .getElementById("exportBtn")
    ?.addEventListener("click", handleExport);
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

  document.getElementById("duplicateArea").innerHTML = "";
  document.getElementById("exportBtn").disabled = true;

  showStatus(`🔄 Processing ${files.length} files...`, "info");

  Array.from(files).forEach(file => parseFile(file));
}

// ==================================================
// FILE PARSING
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
      row,
      approved: false,
      rejected: false
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
    ingestionComplete();
  }
}

function ingestionComplete() {
  groupRowsByFob();
  analyzeFobGroups();
  renderDuplicateUI();

  showStatus(
    `✅ Loaded ${combinedRows.length} records from ${filesProcessed} files.<br>
     🔑 Unique Fobs: ${Object.keys(fobGroups).length}<br>
     ⚠️ Duplicate Fobs: ${duplicateFobGroups.length}`,
    "success"
  );
}

// ==================================================
// FOB GROUPING + ANALYSIS
// ==================================================
function groupRowsByFob() {
  fobGroups = {};
  combinedRows.forEach(r => {
    if (!fobGroups[r.fob]) fobGroups[r.fob] = [];
    fobGroups[r.fob].push(r);
  });
}

function analyzeFobGroups() {
  duplicateFobGroups = [];
  uniqueFobRows = [];

  Object.values(fobGroups).forEach(group => {
    if (group.length === 1) {
      group[0].approved = true;
      uniqueFobRows.push(group[0]);
    } else {
      duplicateFobGroups.push(group);
    }
  });
}

// ==================================================
// PHASE 3: DUPLICATE RESOLUTION UI
// ==================================================
function renderDuplicateUI() {
  const area = document.getElementById("duplicateArea");
  area.innerHTML = "";

  if (duplicateFobGroups.length === 0) {
    document.getElementById("exportBtn").disabled = false;
    return;
  }

  duplicateFobGroups.forEach((group, index) => {
    const container = document.createElement("div");
    container.className = "dupe-group";

    const title = document.createElement("h4");
    title.textContent = `Fob ${group[0].fob}`;
    container.appendChild(title);

    group.forEach((record, i) => {
      const label = document.createElement("label");
      label.style.display = "block";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `fob_${index}`;
      radio.onchange = () => {
        group.forEach(r => {
          r.approved = false;
          r.rejected = true;
        });
        record.approved = true;
        record.rejected = false;
        validateAllResolved();
      };

      label.appendChild(radio);
      label.append(
        ` ${record.sourceFile} | ${record.row.join(" | ")}`
      );

      container.appendChild(label);
    });

    area.appendChild(container);
  });
}

// ==================================================
// VALIDATION
// ==================================================
function validateAllResolved() {
  const unresolved = duplicateFobGroups.some(group =>
    group.filter(r => r.approved).length !== 1
  );

  document.getElementById("exportBtn").disabled = unresolved;
}

// ==================================================
// EXPORT PLACEHOLDER (NEXT PHASE)
// ==================================================
function handleExport() {
  alert(
    "✅ All duplicate fobs resolved.\n\nNext: export logic (Phase 4)."
  );
}

// ==================================================
// STATUS
// ==================================================
function showStatus(message, type) {
  const area = document.getElementById("statusArea");
  if (!area) return;
  area.innerHTML = `<p class="${type}">${message}</p>`;
}
