require('dotenv').config();

const { google } = require('googleapis');

const SHEET_ID      = process.env.GOOGLE_SHEET_ID;
const QUEUES_SHEET  = 'Queues';   // Sheet 1 tab name
const STAFF_SHEET   = 'Staff';    // Sheet 2 tab name

// ── Auth ──
// Uses credentials from environment variable
function getAuth() {
  let credentials;
  
  // Check if we have credentials in environment variable
  if (process.env.GOOGLE_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } 
  // Fallback for local development with file (not recommended for production)
  else if (require('fs').existsSync('credentials.json')) {
    credentials = require('./credentials.json');
  }
  else {
    throw new Error('No Google credentials found. Set GOOGLE_CREDENTIALS in .env or add credentials.json');
  }
  
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  return auth;
}

async function getSheets() {
  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

// ── Read all rows from a sheet tab ──
async function getRows(sheetName) {
  const sheets = await getSheets();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${sheetName}!A:Z`,
  });

  const rows = res.data.values || [];
  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      let value = row[i] || '';
      // Ensure assigned_counter is treated as string for consistent comparison
      if (header === 'assigned_counter') {
        value = String(value);
      }
      obj[header] = value;
    });
    return obj;
  });
}

// ── Append a new row ──
async function appendRow(sheetName, rowData) {
  const sheets = await getSheets();

  // Get headers first so we write columns in the right order
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${sheetName}!1:1`,
  });

  const headers = headerRes.data.values?.[0] || [];
  const row     = headers.map((h) => rowData[h] ?? '');

  await sheets.spreadsheets.values.append({
    spreadsheetId:     SHEET_ID,
    range:             `${sheetName}!A:Z`,
    valueInputOption:  'USER_ENTERED',
    insertDataOption:  'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

// ── Update a specific cell by finding a matching row ──
async function updateRow(sheetName, matchColumn, matchValue, updates) {
  const sheets = await getSheets();

  // Get all data
  const res  = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `${sheetName}!A:Z`,
  });

  const rows    = res.data.values || [];
  if (rows.length === 0) return;

  const headers    = rows[0];
  const matchIndex = headers.indexOf(matchColumn);
  if (matchIndex === -1) throw new Error(`Column "${matchColumn}" not found`);

  // Find the row (1-indexed, +1 for header row)
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[matchIndex] == matchValue);
  if (rowIndex === -1) throw new Error(`Row with ${matchColumn}="${matchValue}" not found`);

  const sheetRowNumber = rowIndex + 1; // Sheets rows are 1-indexed

  // Build update requests for each changed column
  const requests = Object.entries(updates).map(([col, value]) => {
    const colIndex  = headers.indexOf(col);
    if (colIndex === -1) return null;
    const colLetter = columnToLetter(colIndex + 1);
    return {
      range:  `${sheetName}!${colLetter}${sheetRowNumber}`,
      values: [[value]],
    };
  }).filter(Boolean);

  // Batch update all changed cells
  if (requests.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: requests,
      },
    });
  }
}

// ── Helper: column number to letter (1 = A, 2 = B, 27 = AA …) ──
function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const remainder = (col - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    col    = Math.floor((col - 1) / 26);
  }
  return letter;
}

// ── Queue-specific helpers ──

async function getAllQueues(dept = null) {
  const rows = await getRows(QUEUES_SHEET);
  if (!dept) return rows;
  return rows.filter((r) => r.department === dept);
}

async function getQueueByNumber(queueNumber) {
  const rows = await getRows(QUEUES_SHEET);
  return rows.find((r) => r.queue_number === queueNumber) || null;
}

async function addQueueEntry(data) {
  // Make sure assigned_counter is included
  const queueData = {
    queue_number: data.queue_number,
    patient_name: data.patient_name,
    mobile: data.mobile,
    email: data.email,
    department: data.department,
    assigned_counter: data.assigned_counter || '1',  // NEW FIELD
    status: data.status || 'Waiting',
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
    ...data
  };
  await appendRow(QUEUES_SHEET, queueData);
}

async function updateQueueStatus(queueNumber, updates) {
  await updateRow(QUEUES_SHEET, 'queue_number', queueNumber, updates);
}

// ── Get queues filtered by assigned counter ──
async function getQueuesByCounter(counterNumber) {
  const rows = await getRows(QUEUES_SHEET);
  return rows.filter((r) => r.assigned_counter == counterNumber);
}

// ── Staff-specific helpers ──

async function getStaffByUsername(username) {
  const rows = await getRows(STAFF_SHEET);
  return rows.find((r) => r.username === username) || null;
}

module.exports = {
  getAllQueues,
  getQueueByNumber,
  addQueueEntry,
  updateQueueStatus,
  getQueuesByCounter,
  getStaffByUsername,
};