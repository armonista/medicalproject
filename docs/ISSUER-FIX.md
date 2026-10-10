# Issuer identity correction

- Patient Wallet no longer hard-codes `BlindMatch Demo Hospital`.
- New signed credentials include `issuerName`, `issuerOrganizationId`, and `issuerHospitalId`.
- Existing credentials are resolved against persistent credential metadata at `/api/credentials/:id/status`.
- Patient verification cross-checks issuer identity when both signed VC and registry metadata contain it.
- Hospital issuance retries once if the dev API restarts during a Vite proxied request.
