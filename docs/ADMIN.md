# Admin / Trust Registry

Admin Portal: http://localhost:5176

Demo admin key: `blindmatch-admin-demo-key`

The admin can register Hospitals and Research Organizations, approve/reject/suspend them, store public-key/DID metadata, and review audit events.

Default demo organizations:
- Hospital ID: `org-hospital-demo`
- Research Organization ID: `org-research-demo`

Credential issuance is allowed only for an APPROVED HOSPITAL. New trial creation is allowed only for an APPROVED RESEARCH_ORG.

This registry is in-memory for the academic prototype. Restarting the API resets admin changes.
