import fs from 'node:fs';
import { dbPath, get } from '../src/database.js';
const tables = ['organizations','users','trials','credentials','matches','audit'];
console.log('BlindMatch SQLite status');
console.log('Path:', dbPath());
console.log('Exists:', fs.existsSync(dbPath()));
if (fs.existsSync(dbPath())) console.log('Size:', fs.statSync(dbPath()).size, 'bytes');
for (const table of tables) console.log(`${table}:`, Number(get(`SELECT COUNT(*) AS n FROM ${table}`)?.n || 0));
