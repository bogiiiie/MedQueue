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
  const queueData = {
    id: data.id || '',                          // ← was missing entirely
    queue_number: data.queue_number,
    patient_name: data.patient_name,
    mobile_number: data.mobile,                 // ← was 'mobile', sheet expects 'mobile_number'
    email: data.email,
    department: data.department,
    assigned_counter: data.assigned_counter || '1',
    counter: `Counter ${data.assigned_counter || '1'}`, // ← was missing entirely
    status: data.status || 'Waiting',
    created_at: data.created_at || new Date().toISOString(),
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

async function getNextQueueNumberForDepartment(department) {
  // Department prefix mapping
  const prefixMap = {
    'General Medicine': 'GEN',
    'Pediatrics': 'PED',
    'Cardiology': 'CARD',
    'Orthopedics': 'ORTHO',
    'Emergency': 'EMERG'
  };
  
  const prefix = prefixMap[department];
  if (!prefix) {
    throw new Error(`Unknown department: ${department}`);
  }
  
  // Get all queues
  const allQueues = await getRows(QUEUES_SHEET);
  
  // Filter only this department's queues
  const deptQueues = allQueues.filter(q => q.department === department);
  
  // Find the highest number
  let maxNumber = 0;
  deptQueues.forEach(queue => {
    // Extract number from queue_number (e.g., "CARD001" -> 1)
    const match = queue.queue_number.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > maxNumber) maxNumber = num;
    }
  });
  
  // Next number is max + 1 (start at 1 if none exist)
  const nextNumber = maxNumber + 1;
  const paddedNumber = nextNumber.toString().padStart(3, '0');
  
  return `${prefix}${paddedNumber}`;
}

// Add this function to sheets.js
async function getNextQueueNumberForDepartment(department) {
  // Department prefix mapping
  const prefixMap = {
    'General Medicine': 'GEN',
    'Pediatrics': 'PED',
    'Cardiology': 'CARD',
    'Orthopedics': 'ORTHO',
    'Emergency': 'EMERG'
  };
  
  const prefix = prefixMap[department];
  if (!prefix) {
    throw new Error(`Unknown department: ${department}`);
  }
  
  // Get all queues
  const allQueues = await getRows(QUEUES_SHEET);
  
  // Filter only this department's queues
  const deptQueues = allQueues.filter(q => q.department === department);
  
  // Find the highest number
  let maxNumber = 0;
  deptQueues.forEach(queue => {
    // Extract number from queue_number (e.g., "CARD001" -> 1, or old "Q001" -> 1)
    const match = queue.queue_number.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > maxNumber) maxNumber = num;
    }
  });
  
  // Next number is max + 1 (start at 1 if none exist)
  const nextNumber = maxNumber + 1;
  const paddedNumber = nextNumber.toString().padStart(3, '0');
  
  return `${prefix}${paddedNumber}`;
}

// Get counter status (open/closed)
async function getCounterStatus(counterNumber) {
  try {
    const rows = await getRows('Counter_Status');
    const counter = rows.find(r => String(r.counter_number) === String(counterNumber));
    return counter ? counter.status : 'open'; // Default to open
  } catch (err) {
    console.error('Failed to get counter status:', err);
    return 'open';
  }
}

// Update counter status
async function updateCounterStatus(counterNumber, status) {
  try {
    const rows = await getRows('Counter_Status');
    const existing = rows.find(r => String(r.counter_number) === String(counterNumber));
    
    if (existing) {
      await updateRow('Counter_Status', 'counter_number', String(counterNumber), {
        status: status,
        last_updated: new Date().toISOString()
      });
    } else {
      await appendRow('Counter_Status', {
        counter_number: String(counterNumber),
        status: status,
        last_updated: new Date().toISOString()
      });
    }
    
    console.log(`Counter ${counterNumber} status updated to: ${status}`);
  } catch (err) {
    console.error('Failed to update counter status:', err);
  }
}

// Get all counter statuses
async function getAllCounterStatuses() {
  try {
    const rows = await getRows('Counter_Status');
    return rows;
  } catch (err) {
    console.error('Failed to get counter statuses:', err);
    return [];
  }
}

module.exports = {
  getAllQueues,
  getQueueByNumber,
  addQueueEntry,
  updateQueueStatus,
  getQueuesByCounter,
  getStaffByUsername,
  getNextQueueNumberForDepartment,
  getCounterStatus,        
  updateCounterStatus,     
  getAllCounterStatuses    
};