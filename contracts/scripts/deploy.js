import hre from 'hardhat';
import fs from 'node:fs';
import path from 'node:path';

const { ethers } = hre;

async function main() {
  const generatedVerifier = path.resolve('contracts/Groth16Verifier.sol');
  if (!fs.existsSync(generatedVerifier)) {
    throw new Error('Groth16Verifier.sol not found. Run `npm run zk:build` from the repository root first.');
  }

  const Verifier = await ethers.getContractFactory('Groth16Verifier');
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();

  const Registry = await ethers.getContractFactory('MatchRegistry');
  const registry = await Registry.deploy(await verifier.getAddress());
  await registry.waitForDeployment();

  console.log('GROTH16_VERIFIER_ADDRESS=' + await verifier.getAddress());
  console.log('MATCH_REGISTRY_ADDRESS=' + await registry.getAddress());
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
