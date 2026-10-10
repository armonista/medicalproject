# BlindMatch 2.0 Stakeholder Flow

## Stakeholders

### Hospital / Credential Issuer
- Opens the Hospital Portal at `http://localhost:5175`.
- Enters patient/MRN reference, patient name and verified clinical values.
- The API signs a W3C-style Verifiable Credential using the demo hospital EVM signing key.
- The server does **not** persist the patient name, MRN, age, biomarker or diagnosis.
- It persists only credential status metadata: credential ID, issuer, payload hash, Poseidon commitment, issue/expiry timestamps and ACTIVE/REVOKED state.
- The hospital hands the signed credential to the patient as a QR/transfer code or JSON file.

### Patient
- Opens the Patient Wallet at `http://localhost:5174` or the HTTPS mobile URL.
- Scans/pastes/imports the hospital credential.
- The wallet verifies the issuer signature and checks server-side credential status.
- The credential can then be encrypted locally with the patient's PIN.
- Trial eligibility is evaluated locally.
- A Groth16 proof is generated from private clinical inputs.
- The proof exposes a Poseidon credential commitment and public trial criteria, not the raw clinical inputs.

### Research Organization
- Opens the Researcher Portal at `http://localhost:5173`.
- Publishes trial eligibility criteria.
- Receives only anonymous verified match records after successful proof verification.
- It never receives the patient name, MRN, age, biomarker, diagnosis or hospital credential JSON.

### Blockchain
- `Groth16Verifier.sol` verifies the proof.
- `MatchRegistry.sol` records the anonymous match.

## Credential-to-proof binding

A hospital-issued credential is bound to the ZK proof through the same Poseidon commitment:

`Poseidon(age, biomarker, diagnosisCode, salt)`

At credential issuance, the server calculates and stores this commitment as non-PHI credential-status metadata. During proof submission, the API requires the proof's public `credentialCommitment` to equal the registered hospital commitment before relaying the proof on-chain. This prevents a patient from using an active credential ID with fabricated private witness values.

## Revocation

The hospital can revoke a credential from its portal. The Patient Wallet checks credential status before proof generation, and the API checks it again immediately before proof submission.

## Prototype limitation

This is an academic prototype. The hospital signing key is deterministic and server-held for demonstration. Production deployment would require real hospital authentication, HSM/KMS-backed keys, audit logging, access controls, secure transport, formal VC/DID profiles, and regulatory review.
