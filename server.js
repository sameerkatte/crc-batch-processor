import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// Serve built React app in production
app.use(express.static(path.join(__dirname, 'dist')));

// Health check for Railway
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

// ── File Write Mutex ────────────────────────────────────────────────────────
// Prevents concurrent read-modify-write race conditions on JSON files.
const fileLocks = new Map();
function withFileLock(filePath, fn) {
  if (!fileLocks.has(filePath)) fileLocks.set(filePath, Promise.resolve());
  const prev = fileLocks.get(filePath);
  let release;
  const next = new Promise(resolve => { release = resolve; });
  fileLocks.set(filePath, next);
  return prev.then(() => fn()).finally(() => release());
}

// ── Config ──────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const APPS_SCRIPT_API_KEY = process.env.APPS_SCRIPT_API_KEY;
const GOOGLE_KEY_PATH = process.env.GOOGLE_KEY_PATH || './service-account-key.json';
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'crc-batch-default-secret-change-me';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// Startup validation — fail fast if critical config is missing
const requiredEnv = { SPREADSHEET_ID, APPS_SCRIPT_URL, APPS_SCRIPT_API_KEY };
for (const [key, val] of Object.entries(requiredEnv)) {
  if (!val) {
    console.error(`FATAL: Missing required env var ${key}. Check your .env file.`);
    process.exit(1);
  }
}

if (ADMIN_EMAILS.length === 0) {
  console.warn('WARNING: No ADMIN_EMAILS configured. No one can access the admin panel.');
}

const HEADER_ROW = [
  'DE_ID', 'DEName', 'Fathers Name', 'DOB', 'Permanent Address',
  'Result', 'NumberOfCases', 'Colour', 'QC Colour',
  'Reason', 'Case Link', 'Case category', 'Act', 'Section', 'Case status',
  'Case Link', '', 'Case Link', '', 'Reason', 'Case link'
];

// Column name candidates for fuzzy matching uploaded file headers
const COLUMN_MAP = [
  { target: 'DE_ID',            candidates: ['de_id', 'deid', 'de id', 'transaction'] },
  { target: 'DEName',           candidates: ['dename', 'de name', 'de_name', 'name'] },
  { target: 'Fathers Name',     candidates: ['father', 'f/o', 's/o', 'father name'] },
  { target: 'DOB',              candidates: ['dob', 'date of birth', 'birth'] },
  { target: 'Permanent Address', candidates: ['address', 'permanent'] },
];

// ── User Storage (JSON file) ────────────────────────────────────────────────

const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
  if (!existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Locked read-modify-write for users: prevents concurrent mutation races
function withUsers(fn) {
  return withFileLock(USERS_FILE, () => {
    const users = loadUsers();
    const result = fn(users);
    saveUsers(users);
    return result;
  });
}

// ── Bucket Storage ───────────────────────────────────────────────────────────

const BUCKETS_FILE = path.join(__dirname, 'buckets.json');

function loadBuckets() {
  if (!existsSync(BUCKETS_FILE)) return [];
  try { return JSON.parse(readFileSync(BUCKETS_FILE, 'utf8')); }
  catch { return []; }
}

function saveBuckets(buckets) {
  writeFileSync(BUCKETS_FILE, JSON.stringify(buckets, null, 2));
}

// Locked read-modify-write for buckets
function withBuckets(fn) {
  return withFileLock(BUCKETS_FILE, () => {
    const buckets = loadBuckets();
    const result = fn(buckets);
    saveBuckets(buckets);
    return result;
  });
}

function getBucket(bucketId) {
  const buckets = loadBuckets();
  const id = bucketId || 'default';
  const found = buckets.find(b => b.id === id);
  if (found) return found;
  // Fallback for 'default' if not in buckets.json
  if (id === 'default') {
    return {
      id: 'default',
      name: 'Default',
      spreadsheetId: SPREADSHEET_ID,
      appsScriptUrl: APPS_SCRIPT_URL,
      appsScriptApiKey: APPS_SCRIPT_API_KEY,
    };
  }
  return null;
}

// Default HyperVerge config for buckets
const DEFAULT_HV_CONFIG = {
  hvApiUrl: 'https://ind-engine.thomas.hyperverge.co/v1/criminalRiskCheck',
  hvAppId: '',
  hvAppKey: '',
  batchSize: 100,
  qps: 15,
  maxRetries: 3,
};

// Seed default bucket if buckets.json doesn't exist
if (!existsSync(BUCKETS_FILE)) {
  saveBuckets([{
    id: 'default',
    name: 'Default',
    spreadsheetId: SPREADSHEET_ID,
    appsScriptUrl: APPS_SCRIPT_URL,
    appsScriptApiKey: APPS_SCRIPT_API_KEY,
    ...DEFAULT_HV_CONFIG,
    createdAt: new Date().toISOString(),
  }]);
  console.log('Seeded default bucket from .env config.');
}

// ── Job History Storage ──────────────────────────────────────────────────────

const HISTORY_FILE = path.join(__dirname, 'history.json');

function loadHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(readFileSync(HISTORY_FILE, 'utf8')); }
  catch { return []; }
}

function saveHistory(history) {
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function addHistoryEntry(entry) {
  return withFileLock(HISTORY_FILE, () => {
    const history = loadHistory();
    history.unshift(entry); // newest first
    if (history.length > 200) history.length = 200;
    saveHistory(history);
    return entry;
  });
}

// Locked read-modify-write for history
function withHistory(fn) {
  return withFileLock(HISTORY_FILE, () => {
    const history = loadHistory();
    const result = fn(history);
    saveHistory(history);
    return result;
  });
}

// Seed default admin users if users.json doesn't exist
if (!existsSync(USERS_FILE) && ADMIN_EMAILS.length > 0) {
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  const seedUsers = ADMIN_EMAILS.map(email => ({
    email,
    password: defaultPassword,
    role: 'admin',
    bucketId: 'default',
    createdAt: new Date().toISOString(),
  }));
  saveUsers(seedUsers);
  console.log(`Seeded ${seedUsers.length} admin user(s). Default password: admin123 — CHANGE IT via admin panel.`);
}

// ── Auth Middleware ──────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// ── Google Sheets Auth ──────────────────────────────────────────────────────

let sheetsClient = null;

async function getSheets() {
  if (sheetsClient) return sheetsClient;

  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    // Railway / cloud: service account JSON passed as env var
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else {
    // Local dev: read from file
    credentials = JSON.parse(readFileSync(GOOGLE_KEY_PATH, 'utf8'));
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getYesterdayTabName() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear() % 100;
  return `${day}/${month}/${year}`;
}

// Track active jobs to prevent concurrent runs (persisted to survive restarts)
const activeJobs = new Map();
const MAX_JOB_DURATION_MS = 3 * 60 * 60 * 1000;
const ACTIVE_JOBS_FILE = path.join(__dirname, 'active-jobs.json');

function persistActiveJobs() {
  try {
    const obj = Object.fromEntries(activeJobs);
    writeFileSync(ACTIVE_JOBS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to persist active jobs:', err.message);
  }
}

function loadPersistedActiveJobs() {
  if (!existsSync(ACTIVE_JOBS_FILE)) return;
  try {
    const obj = JSON.parse(readFileSync(ACTIVE_JOBS_FILE, 'utf8'));
    for (const [key, val] of Object.entries(obj)) {
      activeJobs.set(key, val);
    }
    console.log(`Restored ${activeJobs.size} active job(s) from disk.`);
  } catch { /* ignore corrupted file */ }
}
loadPersistedActiveJobs();

function cleanStaleJobs() {
  const now = Date.now();
  let cleaned = false;
  for (const [name, job] of activeJobs) {
    if (now - job.startTime > MAX_JOB_DURATION_MS) {
      activeJobs.delete(name);
      cleaned = true;
    }
  }
  if (cleaned) persistActiveJobs();
}

function buildTriggerBody(sheetName, bucket) {
  return JSON.stringify({
    fileName: sheetName,
    config: {
      spreadsheetId: bucket.spreadsheetId || SPREADSHEET_ID,
      apiUrl: bucket.hvApiUrl || DEFAULT_HV_CONFIG.hvApiUrl,
      appId: bucket.hvAppId || '',
      appKey: bucket.hvAppKey || '',
      batchSize: bucket.batchSize || DEFAULT_HV_CONFIG.batchSize,
      qps: bucket.qps || DEFAULT_HV_CONFIG.qps,
      maxRetries: bucket.maxRetries || DEFAULT_HV_CONFIG.maxRetries,
    },
  });
}

function validateSheetName(name) {
  if (!name || name.length > 100) return 'Sheet name must be 1-100 characters.';
  if (/'/.test(name)) return "Sheet name cannot contain apostrophes.";
  if (/[*?:\\\[\]]/.test(name)) return "Sheet name cannot contain * ? : \\ [ ] characters.";
  return null;
}

function findColumnIndex(headers, candidates) {
  const normalized = headers.map(h => String(h || '').toLowerCase().trim());
  // Pass 1: exact match (e.g., "dename" matches "dename" exactly)
  for (const c of candidates) {
    const cl = c.toLowerCase();
    const idx = normalized.findIndex(h => h === cl);
    if (idx !== -1) return idx;
  }
  // Pass 2: substring match for longer candidates only (>4 chars)
  // to avoid short words like "name" matching "fathers name"
  for (const c of candidates) {
    const cl = c.toLowerCase();
    if (cl.length <= 4) continue;
    const idx = normalized.findIndex(h => h.includes(cl));
    if (idx !== -1) return idx;
  }
  // Pass 3: fallback substring match for all candidates
  return normalized.findIndex(h =>
    candidates.some(c => h.includes(c.toLowerCase()))
  );
}

function excelSerialToDate(serial) {
  if (typeof serial !== 'number' || serial < 1) return serial;
  // Excel epoch: Jan 0, 1900 (with the intentional Lotus 1-2-3 leap year bug)
  const utcDays = Math.floor(serial) - 25569; // days from Unix epoch
  const ms = utcDays * 86400 * 1000;
  const d = new Date(ms);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function parseFileRaw(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 2) {
    throw new Error('File must have a header row and at least 1 data row.');
  }

  return { headers: rows[0], rows };
}

function autoDetectMapping(headers) {
  const mapping = {};
  const missing = [];

  for (const col of COLUMN_MAP) {
    const idx = findColumnIndex(headers, col.candidates);
    if (idx === -1) {
      missing.push(col.target);
    } else {
      mapping[col.target] = idx;
    }
  }

  return { mapping, missing };
}

function buildDataRows(rows, headers, mapping) {
  const dataRows = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[mapping['DE_ID']] && !r[mapping['DEName']]) continue;

    let dob = r[mapping['DOB']] || '';
    if (typeof dob === 'number') {
      dob = excelSerialToDate(dob);
    }

    dataRows.push([
      r[mapping['DE_ID']] || '',
      r[mapping['DEName']] || '',
      r[mapping['Fathers Name']] || '',
      dob,
      r[mapping['Permanent Address']] || '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ]);
  }

  const detected = {};
  for (const [target, idx] of Object.entries(mapping)) {
    detected[target] = String(headers[idx]);
  }

  return { dataRows, detected, totalRows: dataRows.length };
}

// Legacy wrapper used by upload when no custom mapping provided
function parseFile(buffer) {
  const { headers, rows } = parseFileRaw(buffer);
  const { mapping, missing } = autoDetectMapping(headers);

  if (missing.length > 0) {
    throw new Error(
      `Could not find columns: ${missing.join(', ')}. ` +
      `Detected headers: [${headers.join(', ')}]`
    );
  }

  return buildDataRows(rows, headers, mapping);
}

// ── Auth Routes ─────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const users = loadUsers();
  const user = users.find(u => u.email === email.toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { email: user.email, role: user.role, bucketId: user.bucketId || 'default' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const userBucket = getBucket(user.bucketId || 'default');

  res.json({
    token,
    user: {
      email: user.email,
      role: user.role,
      bucketId: user.bucketId || 'default',
      bucketName: userBucket ? userBucket.name : 'Default',
    },
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const userBucket = getBucket(req.user.bucketId || 'default');
  res.json({
    user: {
      ...req.user,
      bucketName: userBucket ? userBucket.name : 'Default',
    },
  });
});

// ── Admin Routes ────────────────────────────────────────────────────────────

app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = loadUsers().map(u => ({
    email: u.email,
    role: u.role,
    bucketId: u.bucketId || 'default',
    createdAt: u.createdAt,
  }));
  res.json({ users });
});

app.post('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  const { email, password, role, bucketId } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Validate bucket exists
  const assignedBucket = bucketId || 'default';
  if (assignedBucket !== 'default') {
    const bucket = getBucket(assignedBucket);
    if (!bucket) {
      return res.status(400).json({ error: 'Bucket not found.' });
    }
  }

  const userRole = (role === 'admin' && ADMIN_EMAILS.includes(req.user.email)) ? 'admin' : 'user';

  const result = await withUsers(users => {
    if (users.find(u => u.email === normalizedEmail)) {
      return { error: 'User already exists.', status: 409 };
    }
    users.push({
      email: normalizedEmail,
      password: bcrypt.hashSync(password, 10),
      role: userRole,
      bucketId: assignedBucket,
      createdAt: new Date().toISOString(),
    });
    return { message: `User ${normalizedEmail} created as ${userRole}.` };
  });

  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

// Update user's bucket
app.put('/api/admin/users/:email/bucket', authMiddleware, adminMiddleware, async (req, res) => {
  const targetEmail = decodeURIComponent(req.params.email).toLowerCase().trim();
  const { bucketId } = req.body;

  if (!bucketId) {
    return res.status(400).json({ error: 'bucketId is required.' });
  }

  if (bucketId !== 'default') {
    const bucket = getBucket(bucketId);
    if (!bucket) return res.status(400).json({ error: 'Bucket not found.' });
  }

  const result = await withUsers(users => {
    const user = users.find(u => u.email === targetEmail);
    if (!user) return { error: 'User not found.', status: 404 };
    user.bucketId = bucketId;
    return { message: `${targetEmail} assigned to bucket "${bucketId}".` };
  });

  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

app.delete('/api/admin/users/:email', authMiddleware, adminMiddleware, async (req, res) => {
  const targetEmail = decodeURIComponent(req.params.email).toLowerCase().trim();

  if (targetEmail === req.user.email) {
    return res.status(400).json({ error: "You can't delete your own account." });
  }

  const result = await withUsers(users => {
    const idx = users.findIndex(u => u.email === targetEmail);
    if (idx === -1) return { error: 'User not found.', status: 404 };
    users.splice(idx, 1);
    return { message: `User ${targetEmail} deleted.` };
  });

  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

app.put('/api/admin/users/:email/password', authMiddleware, adminMiddleware, async (req, res) => {
  const targetEmail = decodeURIComponent(req.params.email).toLowerCase().trim();
  const { password } = req.body;

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }

  const result = await withUsers(users => {
    const user = users.find(u => u.email === targetEmail);
    if (!user) return { error: 'User not found.', status: 404 };
    user.password = bcrypt.hashSync(password, 10);
    return { message: `Password updated for ${targetEmail}.` };
  });

  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
  res.json({ message: `Password updated for ${targetEmail}.` });
});

// ── Bucket Routes ────────────────────────────────────────────────────────────

app.get('/api/admin/buckets', authMiddleware, adminMiddleware, (req, res) => {
  const buckets = loadBuckets();
  res.json({ buckets });
});

app.post('/api/admin/buckets', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, spreadsheetId, appsScriptUrl, appsScriptApiKey } = req.body;
  if (!name || !spreadsheetId || !appsScriptUrl || !appsScriptApiKey) {
    return res.status(400).json({ error: 'All fields are required: name, spreadsheetId, appsScriptUrl, appsScriptApiKey.' });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `bucket-${Date.now()}`;

  const result = await withBuckets(buckets => {
    if (buckets.find(b => b.id === id)) {
      return { error: `Bucket "${id}" already exists.`, status: 409 };
    }
    buckets.push({
      id,
      name: name.trim(),
      spreadsheetId: spreadsheetId.trim(),
      appsScriptUrl: appsScriptUrl.trim(),
      appsScriptApiKey: appsScriptApiKey.trim(),
      hvApiUrl: (req.body.hvApiUrl || DEFAULT_HV_CONFIG.hvApiUrl).trim(),
      hvAppId: (req.body.hvAppId || '').trim(),
      hvAppKey: (req.body.hvAppKey || '').trim(),
      batchSize: Number(req.body.batchSize) || DEFAULT_HV_CONFIG.batchSize,
      qps: Number(req.body.qps) || DEFAULT_HV_CONFIG.qps,
      maxRetries: Number(req.body.maxRetries) || DEFAULT_HV_CONFIG.maxRetries,
      createdAt: new Date().toISOString(),
    });
    return { message: `Bucket "${name}" created.`, id };
  });

  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

app.put('/api/admin/buckets/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const bucketId = req.params.id;
  const { name, spreadsheetId, appsScriptUrl, appsScriptApiKey } = req.body;

  const result = await withBuckets(buckets => {
    const bucket = buckets.find(b => b.id === bucketId);
    if (!bucket) return { error: 'Bucket not found.', status: 404 };

    if (name) bucket.name = name.trim();
    if (spreadsheetId) bucket.spreadsheetId = spreadsheetId.trim();
    if (appsScriptUrl) bucket.appsScriptUrl = appsScriptUrl.trim();
    if (appsScriptApiKey) bucket.appsScriptApiKey = appsScriptApiKey.trim();
    if (req.body.hvApiUrl !== undefined) bucket.hvApiUrl = req.body.hvApiUrl.trim();
    if (req.body.hvAppId !== undefined) bucket.hvAppId = req.body.hvAppId.trim();
    if (req.body.hvAppKey !== undefined) bucket.hvAppKey = req.body.hvAppKey.trim();
    if (req.body.batchSize !== undefined) bucket.batchSize = Number(req.body.batchSize) || 100;
    if (req.body.qps !== undefined) bucket.qps = Number(req.body.qps) || 15;
    if (req.body.maxRetries !== undefined) bucket.maxRetries = Number(req.body.maxRetries) || 3;

    return { message: `Bucket "${bucket.name}" updated.` };
  });

  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

app.delete('/api/admin/buckets/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const bucketId = req.params.id;
  if (bucketId === 'default') {
    return res.status(400).json({ error: 'Cannot delete the default bucket.' });
  }

  // Lock both files since we modify buckets and potentially users
  const result = await withBuckets(buckets => {
    const idx = buckets.findIndex(b => b.id === bucketId);
    if (idx === -1) return { error: 'Bucket not found.', status: 404 };
    buckets.splice(idx, 1);

    // Reassign users in this bucket to default
    const users = loadUsers();
    let reassigned = 0;
    for (const u of users) {
      if (u.bucketId === bucketId) { u.bucketId = 'default'; reassigned++; }
    }
    if (reassigned > 0) saveUsers(users);

    return { message: `Bucket deleted. ${reassigned} user(s) moved to default.` };
  });

  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

// ── Preview Route (parse file, return mapping + sample data) ─────────────────

app.post('/api/preview', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      return res.status(400).json({ error: 'Unsupported file type. Upload .xlsx, .xls, or .csv.' });
    }

    const { headers, rows } = parseFileRaw(req.file.buffer);
    const { mapping, missing } = autoDetectMapping(headers);

    // Build sample rows (first 5 data rows) with DOB conversion
    const sampleRows = [];
    for (let i = 1; i < rows.length && sampleRows.length < 5; i++) {
      const r = rows[i];
      const row = headers.map((_, ci) => {
        let val = r[ci] || '';
        if (typeof val === 'number' && mapping['DOB'] === ci) {
          val = excelSerialToDate(val);
        }
        return val;
      });
      sampleRows.push(row);
    }

    // Target columns the user needs to map
    const targets = COLUMN_MAP.map(c => c.target);

    res.json({
      headers: headers.map(h => String(h || '')),
      mapping,       // { target: sourceIndex }
      missing,       // targets that couldn't be auto-detected
      sampleRows,
      targets,
      totalDataRows: rows.length - 1,
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Upload & Status Routes (auth-gated) ─────────────────────────────────────

app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      return res.status(400).json({ error: 'Unsupported file type. Upload .xlsx, .xls, or .csv.' });
    }

    // Resolve user's bucket
    const userBucketId = req.user.bucketId || 'default';
    const bucket = getBucket(userBucketId);
    if (!bucket) {
      return res.status(400).json({ error: `Bucket "${userBucketId}" not found. Contact admin.` });
    }

    const sheetName = (req.body.sheetName && req.body.sheetName.trim()) || getYesterdayTabName();

    const nameError = validateSheetName(sheetName);
    if (nameError) {
      return res.status(400).json({ error: nameError });
    }

    const jobKey = `${bucket.id}:${sheetName}`;
    cleanStaleJobs();
    const existingJob = activeJobs.get(jobKey);
    if (existingJob && !req.body.overwrite) {
      return res.status(409).json({
        error: `A job is already running for sheet "${sheetName}" (started by ${existingJob.startedBy || 'unknown'}).`,
        activeJob: true,
        sheetName,
        totalRows: existingJob.totalRows,
        startedBy: existingJob.startedBy,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${bucket.spreadsheetId}/edit`,
      });
    }

    // Use custom column mapping from preview step if provided
    let dataRows, detected, totalRows;
    if (req.body.columnMapping) {
      let customMapping;
      try { customMapping = JSON.parse(req.body.columnMapping); } catch { customMapping = null; }
      if (customMapping && typeof customMapping === 'object') {
        const { headers, rows } = parseFileRaw(req.file.buffer);
        // Convert string indices to numbers
        const mapping = {};
        for (const [target, idx] of Object.entries(customMapping)) {
          mapping[target] = Number(idx);
        }
        ({ dataRows, detected, totalRows } = buildDataRows(rows, headers, mapping));
      } else {
        ({ dataRows, detected, totalRows } = parseFile(req.file.buffer));
      }
    } else {
      ({ dataRows, detected, totalRows } = parseFile(req.file.buffer));
    }

    if (totalRows === 0) {
      return res.status(400).json({ error: 'No data rows found in file.' });
    }

    const sheets = await getSheets();
    const overwrite = req.body.overwrite === 'true';
    const bucketSpreadsheetId = bucket.spreadsheetId;

    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: bucketSpreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: sheetName }
            }
          }]
        }
      });
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        if (!overwrite) {
          return res.status(409).json({
            error: `Sheet tab "${sheetName}" already exists.`,
            sheetName,
            canOverwrite: true,
          });
        }

        const meta = await sheets.spreadsheets.get({ spreadsheetId: bucketSpreadsheetId });
        const existing = meta.data.sheets.find(s => s.properties.title === sheetName);
        if (existing) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: bucketSpreadsheetId,
            requestBody: {
              requests: [{ deleteSheet: { sheetId: existing.properties.sheetId } }]
            }
          });
        }
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: bucketSpreadsheetId,
          requestBody: {
            requests: [{
              addSheet: { properties: { title: sheetName } }
            }]
          }
        });
      } else {
        throw err;
      }
    }

    const allRows = [HEADER_ROW, ...dataRows];

    await sheets.spreadsheets.values.update({
      spreadsheetId: bucketSpreadsheetId,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: allRows },
    });

    let triggerResult = 'OK';
    try {
      const triggerUrl = `${bucket.appsScriptUrl}?apiKey=${encodeURIComponent(bucket.appsScriptApiKey)}`;
      const triggerRes = await fetch(triggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildTriggerBody(sheetName, bucket),
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      const triggerBody = await triggerRes.text();
      try {
        const parsed = JSON.parse(triggerBody);
        triggerResult = parsed.error
          ? `${parsed.status || 'ERROR'}: ${parsed.error}`
          : (parsed.status || 'OK');
      } catch {
        triggerResult = triggerBody.substring(0, 200);
      }
    } catch (triggerErr) {
      if (triggerErr.name === 'TimeoutError' || triggerErr.name === 'AbortError') {
        triggerResult = 'STARTED (script running in background)';
      } else {
        triggerResult = 'TRIGGER_FAILED: ' + triggerErr.message;
      }
    }

    activeJobs.set(jobKey, { startTime: Date.now(), totalRows, startedBy: req.user.email });
    persistActiveJobs();

    // Record in history
    const historyId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addHistoryEntry({
      id: historyId,
      sheetName,
      fileName: req.file.originalname,
      totalRows,
      uploadedBy: req.user.email,
      bucketId: bucket.id,
      uploadedAt: new Date().toISOString(),
      triggerResult,
      status: 'running',
    });

    console.log(`[${req.user.email}][${bucket.name}] uploaded ${req.file.originalname} → sheet "${sheetName}" (${totalRows} rows)`);

    res.json({
      sheetName,
      totalRows,
      detected,
      triggerResult,
      historyId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${bucketSpreadsheetId}/edit#gid=0`,
    });

  } catch (err) {
    console.error('Upload error:', err);

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` });
    }

    res.status(500).json({ error: err.message });
  }
});

// ── Re-trigger CRC on existing tab ──────────────────────────────────────────

app.post('/api/trigger', authMiddleware, async (req, res) => {
  try {
    const { sheetName } = req.body;
    if (!sheetName || !sheetName.trim()) {
      return res.status(400).json({ error: 'sheetName is required.' });
    }

    const trimmed = sheetName.trim();
    const nameError = validateSheetName(trimmed);
    if (nameError) return res.status(400).json({ error: nameError });

    const userBucketId = req.user.bucketId || 'default';
    const bucket = getBucket(userBucketId);
    if (!bucket) {
      return res.status(400).json({ error: `Bucket "${userBucketId}" not found. Contact admin.` });
    }

    // Verify the tab exists and count rows
    const sheets = await getSheets();
    let totalRows = 0;
    try {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: bucket.spreadsheetId,
        range: `'${trimmed}'!A1:A`,
      });
      const rows = result.data.values || [];
      totalRows = Math.max(0, rows.length - 1); // minus header
    } catch {
      return res.status(404).json({ error: `Sheet tab "${trimmed}" not found in spreadsheet.` });
    }

    if (totalRows === 0) {
      return res.status(400).json({ error: `Sheet tab "${trimmed}" has no data rows.` });
    }

    // Check for active job
    const jobKey = `${bucket.id}:${trimmed}`;
    cleanStaleJobs();
    const existingTriggerJob = activeJobs.get(jobKey);
    if (existingTriggerJob) {
      return res.status(409).json({
        error: `A job is already running for "${trimmed}" (started by ${existingTriggerJob.startedBy || 'unknown'}).`,
        activeJob: true,
        sheetName: trimmed,
        totalRows: existingTriggerJob.totalRows,
        startedBy: existingTriggerJob.startedBy,
        sheetUrl: `https://docs.google.com/spreadsheets/d/${bucket.spreadsheetId}/edit`,
      });
    }

    // Trigger Apps Script
    let triggerResult = 'OK';
    try {
      const triggerUrl = `${bucket.appsScriptUrl}?apiKey=${encodeURIComponent(bucket.appsScriptApiKey)}`;
      const triggerRes = await fetch(triggerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildTriggerBody(trimmed, bucket),
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      const triggerBody = await triggerRes.text();
      try {
        const parsed = JSON.parse(triggerBody);
        triggerResult = parsed.error
          ? `${parsed.status || 'ERROR'}: ${parsed.error}`
          : (parsed.status || 'OK');
      } catch {
        triggerResult = triggerBody.substring(0, 200);
      }
    } catch (triggerErr) {
      if (triggerErr.name === 'TimeoutError' || triggerErr.name === 'AbortError') {
        triggerResult = 'STARTED (script running in background)';
      } else {
        triggerResult = 'TRIGGER_FAILED: ' + triggerErr.message;
      }
    }

    activeJobs.set(jobKey, { startTime: Date.now(), totalRows, startedBy: req.user.email });
    persistActiveJobs();

    const historyId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addHistoryEntry({
      id: historyId,
      sheetName: trimmed,
      fileName: '(re-trigger)',
      totalRows,
      uploadedBy: req.user.email,
      bucketId: bucket.id,
      uploadedAt: new Date().toISOString(),
      triggerResult,
      status: 'running',
    });

    console.log(`[${req.user.email}][${bucket.name}] re-triggered CRC on "${trimmed}" (${totalRows} rows)`);

    res.json({
      sheetName: trimmed,
      totalRows,
      triggerResult,
      historyId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${bucket.spreadsheetId}/edit`,
    });

  } catch (err) {
    console.error('Trigger error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Cancel a running job ──────────────────────────────────────────────────

app.post('/api/cancel', authMiddleware, async (req, res) => {
  try {
    const { sheetName } = req.body;
    if (!sheetName || !sheetName.trim()) {
      return res.status(400).json({ error: 'sheetName is required.' });
    }

    const trimmed = sheetName.trim();
    const userBucketId = req.user.bucketId || 'default';
    const bucket = getBucket(userBucketId);
    if (!bucket) {
      return res.status(400).json({ error: `Bucket "${userBucketId}" not found.` });
    }

    const jobKey = `${bucket.id}:${trimmed}`;
    const activeJob = activeJobs.get(jobKey);

    // Access control: only the user who started it or an admin can cancel
    if (activeJob && req.user.role !== 'admin' && activeJob.startedBy !== req.user.email) {
      return res.status(403).json({
        error: `Only the user who started this job (${activeJob.startedBy}) or an admin can cancel it.`,
      });
    }

    // Tell Apps Script to cancel
    let cancelResult = 'OK';
    try {
      const cancelUrl = `${bucket.appsScriptUrl}?apiKey=${encodeURIComponent(bucket.appsScriptApiKey)}`;
      const cancelRes = await fetch(cancelUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      const cancelBody = await cancelRes.text();
      try {
        const parsed = JSON.parse(cancelBody);
        cancelResult = parsed.error
          ? `${parsed.status || 'ERROR'}: ${parsed.error}`
          : (parsed.status || 'OK');
      } catch {
        cancelResult = cancelBody.substring(0, 200);
      }
    } catch (cancelErr) {
      if (cancelErr.name === 'TimeoutError' || cancelErr.name === 'AbortError') {
        cancelResult = 'CANCEL_SENT (script may take a moment to stop)';
      } else {
        cancelResult = 'CANCEL_FAILED: ' + cancelErr.message;
      }
    }

    // Clear from active jobs
    activeJobs.delete(jobKey);
    persistActiveJobs();

    // Update history
    await withHistory(history => {
      const entry = history.find(h => h.sheetName === trimmed && h.bucketId === bucket.id && h.status === 'running');
      if (entry) {
        entry.status = 'cancelled';
        entry.cancelledBy = req.user.email;
        entry.cancelledAt = new Date().toISOString();
      }
    });

    console.log(`[${req.user.email}][${bucket.name}] cancelled job on "${trimmed}"`);

    res.json({ message: `Job "${trimmed}" cancelled.`, cancelResult });

  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/status', authMiddleware, async (req, res) => {
  try {
    const sheetName = req.query.sheet;
    if (!sheetName) {
      return res.status(400).json({ error: 'sheet query param required.' });
    }

    // Resolve user's bucket
    const userBucketId = req.user.bucketId || 'default';
    const bucket = getBucket(userBucketId);
    if (!bucket) {
      return res.status(400).json({ error: `Bucket "${userBucketId}" not found.` });
    }

    const sheets = await getSheets();

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: bucket.spreadsheetId,
      range: `'${sheetName}'!A1:P`,
    });

    const rows = result.data.values || [];
    if (rows.length <= 1) {
      return res.json({ processed: 0, total: 0, errors: 0, done: true });
    }

    const dataRows = rows.slice(1);
    const total = dataRows.length;
    let processed = 0;
    let errors = 0;

    for (const row of dataRows) {
      const colF = String(row[5] || '').trim();
      const colP = String(row[15] || '').trim();

      if (colF && colF.charAt(0) === '{') {
        processed++;
      }
      if (colP) {
        errors++;
      }
    }

    let unprocessed = 0;
    for (const row of dataRows) {
      const colF = String(row[5] || '').trim();
      const colP = String(row[15] || '').trim();
      const hasName = !!row[1];
      const hasDob = !!row[3];
      if (hasName && hasDob && (!colF || colF.charAt(0) !== '{') && !colP) {
        unprocessed++;
      }
    }

    // ── DONE DETECTION (with stabilization for retry rounds) ──────────
    // Problem: After the first pass, all rows have either a result in col F
    // or an error in col P, so `unprocessed === 0`. But the Apps Script retry
    // loop may still be running and could resolve those errors. If we mark
    // done immediately, the UI stops polling and misses retry results.
    //
    // Fix: When there are errors, require the counts to stabilize across
    // consecutive polls before marking done. This gives retries time to run.
    const jobKey = `${bucket.id}:${sheetName}`;
    const activeJob = activeJobs.get(jobKey);
    let done = false;

    if (unprocessed === 0) {
      if (errors === 0) {
        // All rows succeeded — genuinely done
        done = true;
      } else if (activeJob) {
        // There are errors but retries might still be running.
        // Track whether counts are stable across consecutive polls.
        const prevProcessed = activeJob._lastProcessed;
        const prevErrors = activeJob._lastErrors;

        if (prevProcessed === processed && prevErrors === errors) {
          // Counts unchanged since last poll — increment stable counter
          activeJob._stablePolls = (activeJob._stablePolls || 0) + 1;
        } else {
          // Counts changed (retry resolved some errors) — reset
          activeJob._stablePolls = 0;
        }

        activeJob._lastProcessed = processed;
        activeJob._lastErrors = errors;

        // After 6 consecutive stable polls (~30s with 5s interval),
        // retries are either done or the job is stuck — mark done.
        // 30s buffer accounts for Apps Script trigger gaps (~3s) and
        // execution startup time between retry rounds.
        if (activeJob._stablePolls >= 6) {
          done = true;
        }
      } else {
        // No active job in memory (server restarted or job was never tracked)
        // — mark done based on sheet state alone
        done = true;
      }
    }

    if (done) {
      activeJobs.delete(jobKey);
      persistActiveJobs();
      // Update history entry status
      await withHistory(history => {
        const entry = history.find(h => h.sheetName === sheetName && h.bucketId === bucket.id && h.status === 'running');
        if (entry) {
          entry.status = errors > 0 ? 'done_with_errors' : 'done';
          entry.completedAt = new Date().toISOString();
          entry.processed = processed;
          entry.errors = errors;
        }
      });
    }

    res.json({ processed, total, errors, unprocessed, done });

  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── History Routes ───────────────────────────────────────────────────────────

app.get('/api/history', authMiddleware, (req, res) => {
  const history = loadHistory();
  const userBucketId = req.user.bucketId || 'default';

  // Admins see all, users see only their bucket
  const filtered = req.user.role === 'admin'
    ? history
    : history.filter(h => (h.bucketId || 'default') === userBucketId);

  res.json({ history: filtered });
});

app.get('/api/history/:id', authMiddleware, async (req, res) => {
  const history = loadHistory();
  const entry = history.find(h => h.id === req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  // Non-admins can only view their own bucket's jobs
  const userBucketId = req.user.bucketId || 'default';
  if (req.user.role !== 'admin' && (entry.bucketId || 'default') !== userBucketId) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  // Resolve the bucket for this entry to get the right spreadsheet
  const entryBucket = getBucket(entry.bucketId || 'default');

  // Fetch live status from sheet
  let liveStatus = null;
  if (entryBucket) {
    try {
      const sheets = await getSheets();
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: entryBucket.spreadsheetId,
        range: `'${entry.sheetName}'!A1:P`,
      });
      const rows = result.data.values || [];
      if (rows.length > 1) {
        const dataRows = rows.slice(1);
        let processed = 0, errors = 0, unprocessed = 0;
        for (const row of dataRows) {
          const colF = String(row[5] || '').trim();
          const colP = String(row[15] || '').trim();
          if (colF && colF.charAt(0) === '{') processed++;
          if (colP) errors++;
          const hasName = !!row[1], hasDob = !!row[3];
          if (hasName && hasDob && (!colF || colF.charAt(0) !== '{') && !colP) unprocessed++;
        }
        liveStatus = { processed, errors, unprocessed, total: dataRows.length, done: unprocessed === 0 };
      }
    } catch { /* sheet may not exist anymore */ }
  }

  // Include sheet URL from the entry's bucket (reuse entryBucket from above)
  const sheetUrl = entryBucket
    ? `https://docs.google.com/spreadsheets/d/${entryBucket.spreadsheetId}/edit`
    : null;

  res.json({ entry, liveStatus, sheetUrl });
});

// Bucket list for authenticated users (name + id only)
app.get('/api/buckets', authMiddleware, (req, res) => {
  const buckets = loadBuckets().map(b => ({ id: b.id, name: b.name }));
  res.json({ buckets });
});

// Get current user's bucket sheet URL
app.get('/api/my-bucket', authMiddleware, (req, res) => {
  const bucket = getBucket(req.user.bucketId || 'default');
  if (!bucket) return res.json({ sheetUrl: null });
  res.json({
    bucketId: bucket.id,
    bucketName: bucket.name,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${bucket.spreadsheetId}/edit`,
  });
});

// GET /api/health — quick health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeJobs: activeJobs.size, uptime: process.uptime() });
});

// Fallback: serve React app for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CRC Batch Processor running at http://localhost:${PORT}`);
});
