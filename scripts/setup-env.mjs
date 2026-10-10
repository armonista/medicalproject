import fs from 'node:fs';
import path from 'node:path';

const write = (p,c) => {
  fs.mkdirSync(path.dirname(p),{recursive:true});
  if(!fs.existsSync(p)) fs.writeFileSync(p,c);
};

write('server/.env',`PORT=4000
DEMO_MODE=false
RPC_URL=http://127.0.0.1:8545
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
MATCH_REGISTRY_ADDRESS=
JWT_SECRET=blindmatch-dev-secret-change-this
# Recommended: keep the database outside the source tree.
# Windows example (forward slashes avoid escaping issues):
DATABASE_PATH=C:/BlindMatchData/blindmatch.sqlite
`);

for(const app of ['researcher','hospital','admin']) {
  write(`apps/${app}/.env`,`VITE_API_URL=\n`);
}
write('apps/patient/.env',`VITE_API_URL=
VITE_ZK_ENABLED=true
`);
console.log('Environment files created where missing.');
console.log('Recommended database: C:/BlindMatchData/blindmatch.sqlite');
