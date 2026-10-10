import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { config } from './config.js';

const abi = [
  'function submitMatch(uint256 trialId,uint256[2] a,uint256[2][2] b,uint256[2] c,uint256[7] publicSignals,address ephemeralPatient) returns (bytes32)',
  'event MatchVerified(uint256 indexed trialId,address indexed ephemeralPatient,uint256 indexed credentialCommitment,bytes32 matchId)'
];

function getContract() {
  if (!config.relayerPrivateKey || !config.matchRegistryAddress) {
    throw new Error('Blockchain mode is enabled but relayer key or registry address is missing.');
  }
  const provider = new JsonRpcProvider(config.rpcUrl);
  const wallet = new Wallet(config.relayerPrivateKey, provider);
  return new Contract(config.matchRegistryAddress, abi, wallet);
}

export async function submitProofOnChain({ trialId, proof, publicSignals, ephemeralPatient }) {
  const contract = getContract();
  const tx = await contract.submitMatch(
    BigInt(trialId),
    proof.pi_a.slice(0, 2).map(BigInt),
    [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]
    ],
    proof.pi_c.slice(0, 2).map(BigInt),
    publicSignals.map(BigInt),
    ephemeralPatient
  );
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}
