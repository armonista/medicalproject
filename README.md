# BlindMatch 2.0 — Final Submission Build

Privacy-preserving decentralized clinical-trial recruitment prototype using signed hospital credentials, local Groth16 zero-knowledge proofs, Solidity verification, RBAC, and persistent SQLite metadata.

## Stakeholders and ports

- Admin / Trust Registry — http://localhost:5176
- Hospital Issuer — http://localhost:5175
- Patient Privacy Wallet — http://localhost:5174
- Research Organization — http://localhost:5173
- API — http://localhost:4000
- Hardhat RPC — http://127.0.0.1:8545

## Final architecture

1. Admin approves Hospitals and Research Organizations and creates staff accounts.
2. Approved Hospital verifies clinical information and issues a signed Verifiable Credential.
3. Patient claims the credential using a short one-time QR token; the raw credential is not stored centrally.
4. Patient Wallet verifies issuer/status and encrypts the credential locally.
5. Research Organization publishes trial criteria.
6. Patient generates a Groth16 eligibility proof locally.
7. `MatchRegistry.sol` + generated `Groth16Verifier.sol` verify the proof.
8. Researcher receives only an anonymous verified match.

## Requirements

- Windows 11 / Linux / macOS
- Node.js 22 LTS recommended
- npm
- 8 GB RAM minimum; 16 GB recommended for circuit compilation
- Optional: `sqlite3` CLI for manual database inspection
- Optional: `cloudflared` for HTTPS mobile Patient Wallet testing

`requirements.txt` is included for submission systems that expect the filename; BlindMatch has no required Python packages.

## Clean installation — Windows

```powershell
cd "C:\Babar Data\Projects\BlindMatch-2.0"
npm install
npm run setup:env
```

The generated `server/.env` uses a dedicated database outside the project:

```env
DATABASE_PATH=C:/BlindMatchData/blindmatch.sqlite
```

Initialize/check it:

```powershell
npm run db:init
npm run db:status
```

### Optional SQLite CLI

BlindMatch itself does not require `sqlite3.exe` because the application uses `sql.js`. For manual inspection on Windows you may install the SQLite CLI, then use:

```powershell
sqlite3 "C:/BlindMatchData/blindmatch.sqlite"
```

See `docs/SQLITE.md` for installation and safe inspection instructions.

## ZK build

```powershell
npm run zk:build
```

Successful output ends with:

```text
[8/8] ZK build complete.
```

Artifacts are copied to the Patient Wallet and the Solidity verifier is generated automatically.

## Blockchain

Terminal 1:

```powershell
npm run chain
```

Terminal 2:

```powershell
npm run chain:compile
npm run chain:deploy
```

Copy the printed `MATCH_REGISTRY_ADDRESS` into `server/.env`.

## Start all portals

Terminal 3:

```powershell
npm run dev
```

## Demo accounts

```text
ADMIN
admin@blindmatch.local
Admin@123

HOSPITAL
hospital@blindmatch.local
Hospital@123

RESEARCHER
researcher@blindmatch.local
Research@123
```

Change demo passwords/secrets before any non-demo deployment.

## Database commands

```powershell
npm run db:init
npm run db:status
npm run db:backup
```

SQLite is file-based, so a “separate database” means the `.sqlite` file lives independently of the application source folder. This makes source upgrades/replacement safer.

Persistent metadata includes organizations, staff users, trials, credential status/hash/commitment metadata, anonymous matches, and audit events. Raw patient clinical credentials from QR handoff are not persisted server-side.

## Mobile Patient Wallet

For actual mobile camera/PWA use, expose the Patient portal through HTTPS:

```powershell
cloudflared tunnel --url http://localhost:5174
```

Open the generated HTTPS URL in mobile Chrome. The Patient Wallet can scan the Hospital QR, verify the credential, generate a proof locally, and submit the anonymous proof while the laptop hosts the API/blockchain.


OR
## Method2 To Run Patient Portal on Mobile
Download the Windows 64-bit executable file and Put the downloaded file in a simple folder, for example:
C:\Cloudflared\
The downloaded filename may be something like:
cloudflared-windows-amd64.exe
Rename it to:
cloudflared.exe
So you have:
C:\Cloudflared\cloudflared.exe
Test it directly from PowerShell:
& "C:\Cloudflared\cloudflared.exe" --version

If that returns a version number, start your BlindMatch tunnel with:
& "C:\Cloudflared\cloudflared.exe" tunnel --url http://localhost:5174

You should then get a temporary address similar to:
https://somethingxxxxx.trycloudflare.com
Open that HTTPS address on your mobile Chrome and test:
Patient Portal
→ Scan Hospital QR
→ Allow camera
→ Scan QR shown on Hospital Portal


## Final regression

Run:

```powershell
npm run regression:static
# With the API running in another terminal:
npm run regression:api
```

See `docs/REGRESSION-REPORT.md` for the final regression checklist and acceptance test.

## Important scope note

This is an academic prototype. It demonstrates privacy-preserving credential/proof flows, but production healthcare deployment would additionally require hardened identity management, HSM/key management, operational security, formal privacy/legal review, disaster recovery, monitoring, and regulatory governance.
