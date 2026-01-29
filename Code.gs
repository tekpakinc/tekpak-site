/***********************
 * Tek-Pak YardFlow — Station Web App (Option A)
 * One deployment, 4 station pages via:
 *   /exec?station=intake
 *   /exec?station=processing
 *   /exec?station=listing
 *   /exec?station=logistics
 ***********************/

const SHEET_ITEMS = "Items";
const SHEET_AUDIT = "Audit";

// --- HTML include helper (for Shared.html) ---
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- Router: serve station-specific UI ---
function doGet(e) {
  const station = (e?.parameter?.station || "intake").toLowerCase();
  const map = {
    intake: "Intake",
    processing: "Processing",
    listing: "Listing",
    logistics: "Logistics",
  };
  const file = map[station] || "Intake";

  const t = HtmlService.createTemplateFromFile(file);
  t.STATION = station; // pass into HTML as template variable

  return t.evaluate()
    .setTitle("Tek-Pak YardFlow")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- Spreadsheet helpers ---
function _ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function _sheet_(name) {
  const sh = _ss_().getSheetByName(name);
  if (!sh) throw new Error(`Missing sheet: ${name}`);
  return sh;
}

function _ensureHeaders_() {
  const items = _sheet_(SHEET_ITEMS);
  const audit = _ss_().getSheetByName(SHEET_AUDIT) || _ss_().insertSheet(SHEET_AUDIT);

  const itemsHeaders = [
    "TP","Stage","Status",
    "Category","Brand","Model","SerialOrIMEI","Qty","Source",
    "AssignedTo","Priority",
    "IntakeNotes",
    "DiagSummary","Decision","PartsNeeded","Cost","PriceTarget","ProcessingNotes",
    "Title","KeySpecs","ConditionGrade","Description","PhotoCount","PhotoChecklist","EbayHtml","EbayItemId","ListingNotes",
    "PackStatus","ShelfBin","Weight","Dims","StorageNotes","ShipNotes",
    "CreatedAt","UpdatedAt"
  ];

  const auditHeaders = ["Timestamp","TP","Action","Field","OldValue","NewValue","User"];

  if (items.getLastRow() === 0) items.appendRow(itemsHeaders);
  else {
    const first = items.getRange(1,1,1,items.getLastColumn()).getValues()[0];
    if (first[0] !== "TP") {
      items.insertRowBefore(1);
      items.getRange(1,1,1,itemsHeaders.length).setValues([itemsHeaders]);
    }
  }

  if (audit.getLastRow() === 0) audit.appendRow(auditHeaders);
  else {
    const firstA = audit.getRange(1,1,1,audit.getLastColumn()).getValues()[0];
    if (firstA[0] !== "Timestamp") {
      audit.insertRowBefore(1);
      audit.getRange(1,1,1,auditHeaders.length).setValues([auditHeaders]);
    }
  }
}

function _headersMap_(sh) {
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h,i)=> map[h] = i);
  return map;
}

function _nowISO_(){ return new Date().toISOString(); }

// TP-YYYYMMDD-#### (daily sequence)
function _newTP_() {
  const sh = _sheet_(SHEET_ITEMS);
  const map = _headersMap_(sh);
  const tpCol = map["TP"] + 1;
  const lastRow = sh.getLastRow();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
  let seq = 1;

  if (lastRow >= 2) {
    const tps = sh.getRange(2, tpCol, lastRow-1, 1).getValues().flat().filter(Boolean);
    const todays = tps.filter(tp => (""+tp).includes(`TP-${today}-`));
    if (todays.length) {
      const nums = todays.map(tp => parseInt((tp+"").split("-").pop(),10)).filter(n=>!isNaN(n));
      seq = (Math.max(...nums) || 0) + 1;
    }
  }
  return `TP-${today}-${String(seq).padStart(4,"0")}`;
}

function getBootstrap() {
  _ensureHeaders_();
  return {
    user: Session.getActiveUser().getEmail() || "unknown",
    stages: ["INTAKE","PROCESSING","LISTING","LOGISTICS","DONE"],
    decisions: ["REPAIR","AS_IS","PART_OUT"],
    priorities: ["LOW","NORMAL","HIGH","URGENT"]
  };
}

function listItems(filters) {
  _ensureHeaders_();
  const sh = _sheet_(SHEET_ITEMS);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  let out = rows.map(r => {
    const obj = {};
    headers.forEach((h,i)=> obj[h] = r[i]);
    return obj;
  });

  if (filters && filters.stage) out = out.filter(x => (x.Stage||"") === filters.stage);

  if (filters && filters.query) {
    const q = filters.query.toLowerCase();
    out = out.filter(x => {
      const hay = [x.TP,x.Category,x.Brand,x.Model,x.SerialOrIMEI,x.Status,x.AssignedTo].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  out.sort((a,b)=> (b.UpdatedAt||"").toString().localeCompare((a.UpdatedAt||"").toString()));
  return out;
}

function getItem(tp) {
  _ensureHeaders_();
  const sh = _sheet_(SHEET_ITEMS);
  const map = _headersMap_(sh);
  const data = sh.getDataRange().getValues();
  const headers = data[0];

  for (let i=1;i<data.length;i++){
    if (data[i][map["TP"]] === tp) {
      const obj = {};
      headers.forEach((h,idx)=> obj[h] = data[i][idx]);
      obj._row = i+1;
      return obj;
    }
  }
  throw new Error("Item not found: " + tp);
}

function createIntakeItem(payload) {
  _ensureHeaders_();
  const sh = _sheet_(SHEET_ITEMS);

  const tp = _newTP_();
  const now = _nowISO_();

  const rowObj = Object.assign({
    TP: tp,
    Stage: "INTAKE",
    Status: "NEW",
    Qty: 1,
    Priority: "NORMAL",
    CreatedAt: now,
    UpdatedAt: now
  }, payload || {});

  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const row = headers.map(h => rowObj[h] !== undefined ? rowObj[h] : "");

  sh.appendRow(row);
  _audit_(tp, "CREATE", "TP", "", tp);
  return getItem(tp);
}

function saveItem(tp, updates) {
  _ensureHeaders_();
  const sh = _sheet_(SHEET_ITEMS);
  const map = _headersMap_(sh);
  const item = getItem(tp);
  const rowNum = item._row;

  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const current = sh.getRange(rowNum,1,1,headers.length).getValues()[0];

  Object.keys(updates||{}).forEach(field=>{
    if (!(field in map)) return;
    const idx = map[field];
    const oldVal = current[idx];
    const newVal = updates[field];
    if (oldVal !== newVal) _audit_(tp, "UPDATE", field, oldVal, newVal);
    current[idx] = newVal;
  });

  current[map["UpdatedAt"]] = _nowISO_();
  sh.getRange(rowNum,1,1,headers.length).setValues([current]);
  return getItem(tp);
}

function moveStage(tp, direction) {
  const boot = getBootstrap();
  const stages = boot.stages;
  const item = getItem(tp);
  const i = stages.indexOf(item.Stage);
  const ni = Math.min(stages.length-1, Math.max(0, i + direction));
  const next = stages[ni];

  const statusByStage = {
    "INTAKE":"NEW",
    "PROCESSING":"PENDING_DIAG",
    "LISTING":"NEEDS_CONTENT",
    "LOGISTICS":"AWAITING_PACK",
    "DONE":"COMPLETE"
  };

  return saveItem(tp, { Stage: next, Status: statusByStage[next] || "" });
}

// Jump to a specific stage (for exceptions)
function jumpToStage(tp, stage, reason) {
  stage = (stage||"").toUpperCase();
  const boot = getBootstrap();
  if (!boot.stages.includes(stage)) throw new Error("Invalid stage: " + stage);

  const statusByStage = {
    "INTAKE":"NEW",
    "PROCESSING":"PENDING_DIAG",
    "LISTING":"NEEDS_CONTENT",
    "LOGISTICS":"AWAITING_PACK",
    "DONE":"COMPLETE"
  };

  const updated = saveItem(tp, { Stage: stage, Status: statusByStage[stage] || "" });
  _audit_(tp, "JUMP", "Stage", "", `${stage} — ${reason || "No reason provided"}`);
  return updated;
}

function _audit_(tp, action, field, oldValue, newValue) {
  const sh = _sheet_(SHEET_AUDIT);
  sh.appendRow([
    _nowISO_(),
    tp,
    action,
    field,
    oldValue === undefined ? "" : oldValue,
    newValue === undefined ? "" : newValue,
    Session.getActiveUser().getEmail() || "unknown"
  ]);
}
