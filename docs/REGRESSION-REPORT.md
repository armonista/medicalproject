# BlindMatch 2.0 Final Regression Report

Date: 2026-10-09

## Scope

Regression scope covers the final four-stakeholder flow:

Admin → Hospital → Patient → Blockchain → Research Organization

and the known defects fixed during development.

## Automated source/static regression

Result: **34/34 checks passed** in the packaging environment.

Validated:

- required Admin/Hospital/Patient/Researcher sources exist
- Patient issuer is dynamic (no hard-coded `Issuer: BlindMatch Demo Hospital`)
- mobile QR scanning uses `Html5Qrcode`
- Patient checks credential status registry
- Researcher Refresh does not pass the React click event as a token
- Researcher session is stored/restored
- Researcher periodically refreshes anonymous matches
- Hospital transfer-code clipboard fallback exists
- one-time QR handoff is used
- signed credential carries real issuer name and organization ID
- QR handoff is memory-only
- external `DATABASE_PATH` is supported
- no raw QR credential payload table is present in SQLite schema
- Node syntax checks pass for API/database/auth/issuer/store/credential/handoff/chain/setup files

## Submission-tree cleanup

Removed obsolete implementation artifacts:

- `server/data/credentials.json`
- `server/data/trials.json`
- legacy `circuits/scripts/build.sh`
- unused `MockGroth16Verifier.sol`

The active implementation uses:

- `circuits/scripts/build.mjs` for cross-platform ZK generation
- SQLite persistence for application metadata
- memory-only one-time credential handoffs
- generated `Groth16Verifier.sol` from `npm run zk:build`

## Database regression

Final database behavior:

- supports a dedicated external SQLite file via `DATABASE_PATH`
- creates parent database directory automatically
- creates schema automatically
- seeds demo organizations/users/trial only when absent
- persistent tables: organizations, users, trials, credentials, matches, audit
- raw patient credential is not persisted in the database
- `db:init`, `db:status`, and `db:backup` commands included
- persistence writes use a temporary file + rename to reduce partial-write risk

## Known runtime validation limitation in packaging environment

`npm install` was attempted during final packaging but the isolated artifact environment timed out before dependencies were available. Therefore Vite production builds, Hardhat execution, real Groth16 generation, and browser-camera operation were not re-executed inside that environment.

Those flows had already been exercised iteratively on the user's Windows development machine during this project (including successful `[8/8] ZK build complete`, Solidity compilation/deployment, hospital issuance, QR handoff, issuer display, and portal workflow fixes). The final package preserves those working paths and adds source-level regression checks.

## Recommended final acceptance test on the target Windows PC

A repeatable API integration test is also included as `npm run regression:api`. It checks staff logins, Admin summary access, Hospital credential issuance, one-time handoff consumption, credential status, Researcher trial creation, and anonymous-match API access.

Run, in order:

```powershell
npm install
npm run setup:env
npm run db:init
npm run db:status
npm run regression:static
npm run zk:build
```

Terminal 1:

```powershell
npm run chain
```

Terminal 2:

```powershell
npm run chain:compile
npm run chain:deploy
```

Put the printed `MATCH_REGISTRY_ADDRESS` into `server/.env` and restart the API stack.

Terminal 3:

```powershell
npm run dev
```

Acceptance flow:

1. Admin login succeeds.
2. Create/approve a Hospital and Research Organization; create staff users.
3. Hospital staff login succeeds and issues a signed credential.
4. Patient claims credential by one-time QR/transfer code and sees the correct real issuer.
5. Researcher staff login succeeds and publishes matching criteria.
6. Patient generates real Groth16 proof locally.
7. Patient submits anonymous proof.
8. Researcher sees an `ON_CHAIN` anonymous verified match without being logged out on Refresh.
9. Stop and restart `npm run dev`; organizations/users/trials/credentials metadata/matches/audit remain present in SQLite.
10. Run `npm run db:backup`; verify a timestamped backup file is created.
