# Persistent database and RBAC

BlindMatch now stores non-PHI platform state in `server/data/blindmatch.sqlite` using SQLite via sql.js.

Persisted tables: organizations, users, trials, credential status metadata, anonymous matches and audit events. One-time QR handoffs remain memory-only and expire after 10 minutes so the full clinical credential is not written to the central database.

Raw patient clinical fields are **not** stored in the credentials table. They exist in the signed credential handed to the Patient Wallet. The server retains only credential status/hash/commitment metadata needed for verification and revocation.

## Seeded demo logins

- Admin: `admin@blindmatch.local` / `Admin@123`
- Hospital: `hospital@blindmatch.local` / `Hospital@123`
- Researcher: `researcher@blindmatch.local` / `Research@123`

Change these for any non-demo environment.

JWT sessions expire after 8 hours. `JWT_SECRET` is read from `server/.env`.

## RBAC

- ADMIN: organization approval, user creation/disable, audit
- HOSPITAL: credential issue/revoke for its approved hospital only
- RESEARCHER: publish trials and read anonymous matches for an approved research organization
- PATIENT: no staff login; patient-held credential and proof workflow remains separate
