import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const checks=[];
const ok=(name,pass,detail='')=>checks.push({name,pass,detail});
const text=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));

const required=[
  'apps/admin/src/main.jsx','apps/hospital/src/main.jsx','apps/patient/src/main.jsx','apps/researcher/src/main.jsx',
  'server/src/index.js','server/src/database.js','server/src/auth.js','server/src/issuer.js',
  'contracts/contracts/MatchRegistry.sol','circuits/eligibility.circom','requirements.txt','docs/SQLITE.md'
];
for(const p of required) ok(`required file: ${p}`,exists(p));

const patient=text('apps/patient/src/main.jsx');
ok('patient issuer is dynamic',!patient.includes('Issuer: BlindMatch Demo Hospital'));
ok('patient has mobile QR scanner',patient.includes('Html5Qrcode'));
ok('patient checks credential registry',patient.includes('/api/credentials/'));

const researcher=text('apps/researcher/src/main.jsx');
ok('research refresh button does not pass React event',researcher.includes('onClick={()=>refresh(token)}'));
ok('researcher session stored',researcher.includes("localStorage.setItem('bm-research-token'"));
ok('researcher auto-refreshes matches',researcher.includes('setInterval'));

const hospital=text('apps/hospital/src/main.jsx');
ok('hospital copy fallback exists',hospital.includes("document.execCommand('copy')"));
ok('hospital QR uses one-time handoff code',hospital.includes('handoffCode'));

const issuer=text('server/src/issuer.js');
ok('credential includes real issuer name',issuer.includes('issuerName:hospital.name'));
ok('credential includes issuer organization id',issuer.includes('issuerOrganizationId:org.id'));

const handoff=text('server/src/handoffStore.js');
ok('handoff is memory-only',handoff.includes('new Map()'));

const database=text('server/src/database.js');
ok('external DATABASE_PATH supported',database.includes('process.env.DATABASE_PATH'));
ok('raw handoff credential table removed',!database.includes('credential_json'));

for(const p of ['server/src/index.js','server/src/database.js','server/src/auth.js','server/src/issuer.js','server/src/store.js','server/src/credentialStore.js','server/src/handoffStore.js','server/src/chain.js','scripts/setup-env.mjs']){
  try { execFileSync(process.execPath,['--check',path.join(root,p)],{stdio:'pipe'}); ok(`node syntax: ${p}`,true); }
  catch(e){ ok(`node syntax: ${p}`,false,String(e.stderr||e.message)); }
}

const failed=checks.filter(c=>!c.pass);
for(const c of checks) console.log(`${c.pass?'PASS':'FAIL'}  ${c.name}${c.detail?' — '+c.detail:''}`);
console.log(`\n${checks.length-failed.length}/${checks.length} static regression checks passed.`);
if(failed.length) process.exit(1);
