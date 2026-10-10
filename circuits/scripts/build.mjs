import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const circuitsDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(circuitsDir, '..');
const buildDir = path.join(circuitsDir, 'build');
const patientZkDir = path.join(rootDir, 'apps', 'patient', 'public', 'zk');
const verifierPath = path.join(rootDir, 'contracts', 'contracts', 'Groth16Verifier.sol');

mkdirSync(buildDir, { recursive: true });
mkdirSync(patientZkDir, { recursive: true });

function resolvePackageBin(packageName, binName = packageName) {
  const candidates = [
    path.join(rootDir, 'node_modules', packageName, 'package.json'),
    path.join(circuitsDir, 'node_modules', packageName, 'package.json'),
  ];

  const packageJsonPath = candidates.find(existsSync);

  if (!packageJsonPath) {
    throw new Error(
      `Cannot find ${packageName}. Run "npm install" from the BlindMatch project root first.`
    );
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const bin = packageJson.bin;
  let relativeBin;

  if (typeof bin === 'string') {
    relativeBin = bin;
  } else if (bin && typeof bin === 'object') {
    relativeBin = bin[binName] ?? Object.values(bin)[0];
  }

  if (!relativeBin) {
    throw new Error(`Package ${packageName} does not expose a CLI binary.`);
  }

  return path.resolve(path.dirname(packageJsonPath), relativeBin);
}

const circomCli = resolvePackageBin('circom2', 'circom2');
const snarkjsCli = resolvePackageBin('snarkjs', 'snarkjs');

function runNodeCli(cliPath, args, cwd) {
  console.log(`\n> node "${cliPath}" ${args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ')}`);

  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('BlindMatch 2.0 — Windows-safe ZK build');
console.log(`Platform: ${process.platform}`);
console.log(`Node: ${process.version}`);

console.log('\n[1/8] Compiling Circom circuit...');
runNodeCli(
  circomCli,
  ['eligibility.circom', '--r1cs', '--wasm', '--sym', '-l', path.join(rootDir, 'node_modules'), '-o', buildDir],
  circuitsDir
);

if (!existsSync(path.join(buildDir, 'pot14_final.ptau'))) {
  console.log('\n[2/8] Creating development Powers of Tau ceremony...');
  runNodeCli(snarkjsCli, ['powersoftau', 'new', 'bn128', '14', 'pot14_0000.ptau', '-v'], buildDir);
  runNodeCli(
    snarkjsCli,
    [
      'powersoftau',
      'contribute',
      'pot14_0000.ptau',
      'pot14_0001.ptau',
      '--name=BlindMatch dev contribution',
      '-e=blindmatch-2.0-academic-dev-entropy',
    ],
    buildDir
  );
  runNodeCli(
    snarkjsCli,
    ['powersoftau', 'prepare', 'phase2', 'pot14_0001.ptau', 'pot14_final.ptau', '-v'],
    buildDir
  );
} else {
  console.log('\n[2/8] Reusing existing pot14_final.ptau.');
}

console.log('\n[3/8] Running Groth16 setup...');
runNodeCli(
  snarkjsCli,
  ['groth16', 'setup', 'eligibility.r1cs', 'pot14_final.ptau', 'eligibility_0000.zkey'],
  buildDir
);

console.log('\n[4/8] Contributing to the circuit-specific zkey...');
runNodeCli(
  snarkjsCli,
  [
    'zkey',
    'contribute',
    'eligibility_0000.zkey',
    'eligibility_final.zkey',
    '--name=BlindMatch academic prototype',
    '-e=blindmatch-final-zkey-dev-entropy',
  ],
  buildDir
);

console.log('\n[5/8] Exporting verification key...');
runNodeCli(
  snarkjsCli,
  ['zkey', 'export', 'verificationkey', 'eligibility_final.zkey', 'verification_key.json'],
  buildDir
);

console.log('\n[6/8] Exporting Solidity verifier...');
runNodeCli(
  snarkjsCli,
  ['zkey', 'export', 'solidityverifier', 'eligibility_final.zkey', verifierPath],
  buildDir
);

console.log('\n[7/8] Copying browser proving artifacts...');
const wasmSource = path.join(buildDir, 'eligibility_js', 'eligibility.wasm');
const zkeySource = path.join(buildDir, 'eligibility_final.zkey');

if (!existsSync(wasmSource)) {
  throw new Error(`Expected WASM was not generated: ${wasmSource}`);
}
if (!existsSync(zkeySource)) {
  throw new Error(`Expected zkey was not generated: ${zkeySource}`);
}

copyFileSync(wasmSource, path.join(patientZkDir, 'eligibility.wasm'));
copyFileSync(zkeySource, path.join(patientZkDir, 'eligibility_final.zkey'));

console.log('\n[8/8] ZK build complete.');
console.log(`WASM: ${path.join(patientZkDir, 'eligibility.wasm')}`);
console.log(`ZKEY: ${path.join(patientZkDir, 'eligibility_final.zkey')}`);
console.log(`Verifier: ${verifierPath}`);
console.log('\nNext: set VITE_ZK_ENABLED=true in apps/patient/.env and restart npm run dev.');
