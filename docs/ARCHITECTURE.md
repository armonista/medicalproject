# Architecture

```text
Hospital Portal (5175)
   | verified clinical fields for one-time issuance
   v
Node/Express Hospital Issuer
   | signs VC + stores only status/hash/Poseidon commitment metadata
   | returns signed VC
   v
Patient Wallet (5174; encrypted local credential)
   | verifies issuer + ACTIVE status
   | local eligibility + Groth16 proof
   | proof/publicSignals only
   v
Node/Express Proof Relayer ---------------- Research Organization Portal (5173)
   |                                         |
   | validates credential commitment/status | publishes criteria
   | submits proof                           v
   v                                  Trial metadata JSON/IPFS-ready layer
MatchRegistry.sol --> Groth16Verifier.sol
   |
   v
Anonymous Match event (trialId, ephemeral wallet, commitment)
```

## Privacy boundary

The hospital handles the real clinical record and submits the selected credential fields to the issuer endpoint only while creating a credential. BlindMatch does not persist those raw fields in its credential registry. The signed credential is returned to the patient and can be stored encrypted in the Patient Wallet.

The persistent credential-status registry contains only credential ID, issuer metadata, signature payload hash, Poseidon credential commitment, issue/expiry dates and ACTIVE/REVOKED state.

The Research Organization never receives raw `age`, `biomarker`, `diagnosisCode`, patient name or MRN. The chain stores only anonymous match information.

## Hospital credential binding

The circuit commitment is:

`Poseidon(age, biomarker, diagnosisCode, salt)`

The Hospital Issuer calculates the same commitment at credential issuance and stores it with status metadata. On proof submission, the API requires `publicSignals[0]` to match this hospital-registered commitment and also checks ACTIVE/expiry state. This binds the anonymous ZK proof to the clinical values actually issued by the hospital without storing those values centrally.

## Real ZK public-signal order

For `circuits/eligibility.circom`, SnarkJS exports seven public signals:

0. `credentialCommitment` (circuit output)
1. `minAge`
2. `maxAge`
3. `minBiomarker`
4. `maxBiomarker`
5. `requiredDiagnosis`
6. `trialId`

`MatchRegistry.submitMatch` checks signal 6 against the provided trial ID before verification.
