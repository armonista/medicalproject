# BlindMatch SQLite database

## What "separate SQLite database" means

SQLite is file-based; it does not run as a separate database server. BlindMatch therefore supports a dedicated database file outside the project source directory using `DATABASE_PATH`.

Recommended Windows location:

```text
C:\BlindMatchData\blindmatch.sqlite
```

In `server/.env` use forward slashes:

```env
DATABASE_PATH=C:/BlindMatchData/blindmatch.sqlite
BACKUP_DIR=C:/BlindMatchData/backups
```

This keeps persistent data separate from the source code and makes replacing/upgrading the project folder safer.

## Initialize and check

From the repository root:

```powershell
npm install
npm run setup:env
npm run db:init
npm run db:status
```

The first initialization creates the schema and seeds the demo Admin, Hospital, Researcher organizations/users and demo trial.

## Backup

```powershell
npm run db:backup
```

A timestamped `.sqlite` copy is created in `BACKUP_DIR`, or in a `backups` folder beside the database if `BACKUP_DIR` is not set.

## Optional SQLite CLI installation on Windows

The application itself uses `sql.js`, so `sqlite3.exe` is NOT required to run BlindMatch. Install the SQLite CLI only if you want to inspect the database manually.

Using Windows Package Manager:

```powershell
winget install SQLite.SQLite
```

Then open a NEW PowerShell and check:

```powershell
sqlite3 --version
```

To inspect BlindMatch:

```powershell
sqlite3 "C:/BlindMatchData/blindmatch.sqlite"
```

Useful commands inside SQLite:

```text
.tables
.headers on
.mode column
SELECT id,name,type,status FROM organizations;
SELECT email,role,organization_id,active FROM users;
SELECT id,title,sponsor,status FROM trials;
SELECT credential_id,issuer_name,status,expires_at FROM credentials;
SELECT trial_id,verification,verified_at FROM matches;
.quit
```

Do not manually edit the database with the CLI while the BlindMatch API is running. Stop `npm run dev` first before making any manual write.

## Privacy boundary

The persistent database stores organization/user records, trial criteria, credential status/hash/commitment metadata, anonymous matches and audit events. It does not persist the patient's raw signed clinical credential from the one-time QR handoff; that handoff remains short-lived in API memory.
