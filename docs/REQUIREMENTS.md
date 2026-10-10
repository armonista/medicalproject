# BlindMatch 2.0 Requirements

## Required

- Windows 11, Linux, or macOS
- Node.js 22 LTS recommended
- npm
- Modern Chrome/Edge browser
- 8 GB RAM minimum; 16 GB recommended for ZK compilation

Install JavaScript dependencies with:

```bash
npm install
```

## SQLite

No separate SQLite installation is required. BlindMatch uses `sql.js`, which is installed by npm and writes the persistent database to:

`server/data/blindmatch.sqlite`

A tool such as DB Browser for SQLite is optional if you want to inspect the database manually.

## Mobile Patient Wallet

For camera QR scanning on mobile Chrome, use the Patient Portal through HTTPS. For development, a Cloudflare Quick Tunnel can expose local port 5174 over HTTPS. `cloudflared` is optional and is not a Node or Python dependency.

## Python

Python is not required by the application. A root `requirements.txt` is included for academic/project-submission completeness and intentionally contains no pip dependencies.
