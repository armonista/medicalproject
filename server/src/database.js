import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';

const require = createRequire(import.meta.url);
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
const SQL = await initSqlJs({ locateFile: () => wasmPath });

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDbFile = path.join(here, '..', 'data', 'blindmatch.sqlite');
const configuredDbFile = process.env.DATABASE_PATH?.trim();
const dbFile = path.resolve(configuredDbFile || defaultDbFile);
const dataDir = path.dirname(dbFile);
fs.mkdirSync(dataDir, { recursive: true });

export const db = fs.existsSync(dbFile)
  ? new SQL.Database(fs.readFileSync(dbFile))
  : new SQL.Database();

function persist() {
  const bytes = Buffer.from(db.export());
  const tmp = `${dbFile}.tmp`;
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, dbFile);
}

export function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

export function get(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    return stmt.step() ? stmt.getAsObject() : null;
  } finally {
    stmt.free();
  }
}

export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = [];
  try {
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function execSchema() {
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('HOSPITAL','RESEARCH_ORG')),
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED','SUSPENDED')),
      public_key TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      approved_at TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','HOSPITAL','RESEARCHER')),
      organization_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS trials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sponsor TEXT NOT NULL,
      min_age INTEGER NOT NULL,
      max_age INTEGER NOT NULL,
      min_biomarker INTEGER NOT NULL,
      max_biomarker INTEGER NOT NULL,
      required_diagnosis INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS credentials (
      credential_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      issuer_hospital_id TEXT NOT NULL,
      issuer_name TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      credential_commitment TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      revoked_at TEXT,
      revocation_reason TEXT,
      FOREIGN KEY(organization_id) REFERENCES organizations(id)
    );
    CREATE TABLE IF NOT EXISTS matches (
      match_id TEXT PRIMARY KEY,
      trial_id INTEGER NOT NULL,
      ephemeral_patient TEXT NOT NULL,
      credential_commitment TEXT NOT NULL,
      verified_at TEXT NOT NULL,
      verification TEXT NOT NULL,
      tx_hash TEXT,
      block_number INTEGER,
      FOREIGN KEY(trial_id) REFERENCES trials(id)
    );
    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor_user_id TEXT,
      actor_role TEXT,
      organization_id TEXT,
      details_json TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);
  db.run('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)', ['schema_version', '1']);
  persist();
}

execSchema();

const now = new Date().toISOString();
if (!get('SELECT id FROM organizations WHERE id=?', ['org-hospital-demo'])) {
  run(`INSERT INTO organizations(id,type,name,status,public_key,created_at,approved_at) VALUES(?,?,?,?,?,?,?)`,
    ['org-hospital-demo','HOSPITAL','BlindMatch Demo Hospital','APPROVED','',now,now]);
}
if (!get('SELECT id FROM organizations WHERE id=?', ['org-research-demo'])) {
  run(`INSERT INTO organizations(id,type,name,status,public_key,created_at,approved_at) VALUES(?,?,?,?,?,?,?)`,
    ['org-research-demo','RESEARCH_ORG','BlindMatch Demo Research Centre','APPROVED','',now,now]);
}

async function seedUser(email, password, displayName, role, organizationId = null) {
  if (get('SELECT id FROM users WHERE email=?', [email])) return;
  const hash = await bcrypt.hash(password, 10);
  run(`INSERT INTO users(id,email,password_hash,display_name,role,organization_id,active,created_at) VALUES(?,?,?,?,?,?,1,?)`,
    [crypto.randomUUID(),email,hash,displayName,role,organizationId,now]);
}
await seedUser('admin@blindmatch.local','Admin@123','BlindMatch Administrator','ADMIN',null);
await seedUser('hospital@blindmatch.local','Hospital@123','Demo Hospital Operator','HOSPITAL','org-hospital-demo');
await seedUser('researcher@blindmatch.local','Research@123','Demo Researcher','RESEARCHER','org-research-demo');

if (!get('SELECT id FROM trials LIMIT 1')) {
  run(`INSERT INTO trials(id,organization_id,title,sponsor,min_age,max_age,min_biomarker,max_biomarker,required_diagnosis,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [1001,'org-research-demo','Metabolic Health Study','Demo Research Institute',18,65,70,140,101,'OPEN','2026-10-04T00:00:00.000Z']);
}

export function audit(action, actor = {}, details = {}) {
  run(`INSERT INTO audit(id,action,actor_user_id,actor_role,organization_id,details_json,timestamp) VALUES(?,?,?,?,?,?,?)`, [
    crypto.randomUUID(), action, actor.userId || null, actor.role || null, actor.organizationId || null,
    JSON.stringify(details), new Date().toISOString()
  ]);
}

export function dbPath() { return dbFile; }
