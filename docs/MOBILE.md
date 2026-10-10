# Mobile use

## Recommended demo topology

- Laptop: Hospital Portal (`5175`), Research Organization Portal (`5173`), API (`4000`), Hardhat node (`8545`).
- Mobile phone: Patient Wallet (`5174`) over HTTPS.

The Hospital Portal displays a signed credential QR. The patient scans it from the mobile Patient Wallet. The QR contains the signed credential itself; it is not placed on the blockchain.

## Same Wi-Fi layout test

Run `npm run dev`, find the laptop IPv4 address with `ipconfig`, and open:

`http://<PC-IP>:5174`

This is sufficient for ordinary UI testing. Some mobile security APIs require HTTPS.

## HTTPS patient demo

Use a development HTTPS tunnel pointing to `http://localhost:5174`. Keep `VITE_API_URL=` blank in `apps/patient/.env`; the app calls `/api`, and Vite proxies those calls to `http://127.0.0.1:4000`.

After opening the HTTPS URL on the phone:

1. Hospital Portal on laptop → enter synthetic patient data → **Verify & issue signed credential**.
2. Patient phone → **Scan hospital QR**.
3. Allow camera permission.
4. The wallet verifies the issuer signature and ACTIVE status.
5. Encrypt/save the credential locally.
6. Choose a trial and generate the ZK proof.
7. Submit the anonymous proof.

If the mobile browser does not support the native `BarcodeDetector` API, use **Copy transfer code** in the Hospital Portal and paste it into the Patient Wallet, or download/import the credential JSON.

For a classroom demo, avoid real patient information.

## Mobile QR scanner compatibility

The Patient Wallet uses `html5-qrcode` for camera decoding and does not depend on the browser's experimental `BarcodeDetector` API.

For camera scanning on Android/iPhone:

1. Open the Patient Wallet from an **HTTPS** address. A plain LAN address such as `http://192.168.x.x:5174` can render the page, but mobile browsers may refuse camera access because it is not a secure context.
2. Tap **Scan hospital QR**.
3. Allow the browser's **Camera** permission.
4. Point the rear camera at the QR shown by the Hospital Portal.
5. After decoding, BlindMatch verifies the hospital signature and current credential status before loading it.

If permission was previously denied in Chrome, open the site's permissions (padlock/site controls) and set **Camera → Allow**, then reload the Patient Wallet.

The transfer-code and JSON import methods remain available as fallbacks.
