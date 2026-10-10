import { dbPath, get } from '../src/database.js';
console.log('BlindMatch database initialized.');
console.log('Path:', dbPath());
console.log('Schema version:', get('SELECT value FROM meta WHERE key=?', ['schema_version'])?.value || 'unknown');
