/****************************************
 * JSON API for GitHub Portal
 ****************************************/

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';

  try {
    switch (action) {
      case 'ping':
        return jsonResponse_({ ok: true, message: 'Tek-Pak Inventory API online' });
      case 'getInventory':
        return jsonResponse_({ ok: true, data: getInventoryForApi_() });
      case 'getLists':
        return jsonResponse_({ ok: true, data: getListsForApi_() });
      default:
        return jsonResponse_({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message || err.toString() });
  }
}

function doPost(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  let body = {};
  try {
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'Invalid JSON body' });
  }

  try {
    switch (action) {
      case 'addItem':
        return jsonResponse_({ ok: true, data: addItemFromApi_(body) });
      case 'updateItem':
        return jsonResponse_({ ok: true, data: updateItemFromApi_(body) });
      case 'saveLists':
        return jsonResponse_({ ok: true, data: saveListsFromApi_(body) });
      default:
        return jsonResponse_({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message || err.toString() });
  }
}

/**
 * Read inventory rows as objects.
 */
function getInventoryForApi_() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(INVENTORY_SHEET_NAME);
  if (!sheet) throw new Error('Inventory sheet not found.');

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const items = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    obj.rowIndex = i + 2; // actual sheet row
    if (obj['Title'] || obj['TP-SKU']) {
      items.push(obj);
    }
  }
  return items;
}

/**
 * Return all dropdown lists.
 */
function getListsForApi_() {
  return {
    locations: getListItems('locations'),
    status: getListItems('status'),
    categories: getListItems('categories'),
    manufacturers: getListItems('mfg')
  };
}

/**
 * Add new inventory item.
 * Expects body as { fieldName: value, ... } using header names.
 */
function addItemFromApi_(data) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(INVENTORY_SHEET_NAME);
  if (!sheet) throw new Error('Inventory sheet not found.');

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Auto-generate TP-SKU if missing
  if (!data['TP-SKU']) {
    const ts = new Date().getTime().toString(36).toUpperCase();
    data['TP-SKU'] = 'TP-' + ts;
  }

  const row = headers.map(h => (data[h] !== undefined ? data[h] : ''));
  sheet.appendRow(row);
  const rowIndex = sheet.getLastRow();

  // Re-apply validations just in case
  if (typeof applyAllValidations === 'function') {
    applyAllValidations();
  }

  return { rowIndex: rowIndex, TP_SKU: data['TP-SKU'] };
}

/**
 * Update an existing row by rowIndex.
 * Expects { rowIndex: number, fields: { fieldName: value, ... } }
 */
function updateItemFromApi_(data) {
  const rowIndex = data.rowIndex;
  const fields = data.fields || {};
  if (!rowIndex || rowIndex < 2) {
    throw new Error('Invalid or missing rowIndex.');
  }

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(INVENTORY_SHEET_NAME);
  if (!sheet) throw new Error('Inventory sheet not found.');

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  const existing = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  const updated = [];

  for (let c = 0; c < headers.length; c++) {
    const h = headers[c];
    if (fields.hasOwnProperty(h)) {
      updated[c] = fields[h];
    } else {
      updated[c] = existing[c];
    }
  }

  sheet.getRange(rowIndex, 1, 1, lastCol).setValues([updated]);
  return { rowIndex: rowIndex };
}

/**
 * Save entire lists from API.
 * Expects:
 * {
 *   lists: {
 *     locations: [...],
 *     status: [...],
 *     categories: [...],
 *     manufacturers: [...]
 *   }
 * }
 */
function saveListsFromApi_(data) {
  const lists = data.lists || {};

  if (lists.locations) {
    saveListItems('locations', lists.locations);
  }
  if (lists.status) {
    saveListItems('status', lists.status);
  }
  if (lists.categories) {
    saveListItems('categories', lists.categories);
  }
  if (lists.manufacturers) {
    saveListItems('mfg', lists.manufacturers);
  }

  return { ok: true };
}
