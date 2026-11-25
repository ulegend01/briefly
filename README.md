# Briefly · Research worth unlocking

An original research paywall built on the Fiber encrypted-data-payment starter. Readers preview a Bitcoin programmability research brief, then unlock the full AES-256-GCM encrypted report with a **real 1 CKB Fiber Testnet invoice**.

## Changes from the starter

- Rebranded the application as Briefly with a bespoke editorial layout and report cover.
- Added a free research preview and a full, original Bitcoin/CKB/RGB++ research sample.
- Reframed the Seller and Buyer panels as Publisher Studio and Reader Checkout.
- Updated the Fiber invoice description to identify the research unlock.
- Preserved the original cryptographic, channel, payment-status, retry, and saved-node safety logic.

## Run locally

**Requires Node.js 22.18+** and npm.

```bash
npm install
npm run dev
```

Visit **http://localhost:3001**. Use localhost or HTTPS, because the Fiber WASM runtime requires cross-origin isolation, SharedArrayBuffer, and Web Locks. The Next.js config includes COOP/COEP headers.

## Live demonstration

1. Start Buyer A and Seller C. Fund each generated address with **more than 500 Testnet CKB** from the linked faucet. This is testnet currency, not real CKB.
2. Open each 500 CKB channel and refresh until both report `CHANNEL_READY`. Do not repeatedly create new channels if confirmation is slow.
3. In Publisher Studio, review or edit the research, then click **Encrypt & create 1 CKB Invoice**.
4. Copy the public encrypted offer JSON to Reader Checkout, then validate the offer.
5. Try **Decrypt without key** to demonstrate that the content is protected.
6. Pay the 1 CKB Fiber Testnet invoice, check the receipt and payment hash, then decrypt using the revealed payment preimage.
7. Capture screenshots or a recording of the actual transaction and unlocked report for CKBoost.

The optional 5 CKB liquidity transfer is **not required** when the payment route is ready.

## Security and recovery

Browser local storage holds node identities. **Do not clear it after funding nodes** or you may lose access to those channel identities. Keep one active tab per saved node. The application does not persist the AES key or decrypted report. If a payment times out, check its status instead of blindly sending again. See the original Fiber tutorial for detailed recovery guidance.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Implementation

- `app/page.tsx`: Briefly interface and buyer/seller workflow.
- `app/globals.css`: editorial design system.
- `lib/crypto.ts`: browser AES-256-GCM encryption/decryption.
- `lib/offer.ts`: encrypted offer and invoice creation.
- `lib/payment.ts` and `lib/payment-submission.ts`: invoice validation and safe payment submission.
- `lib/fiber.ts`: browser nodes and Bottle payment channel routing.

Built for CKBoost Advanced Quest using the Fiber encrypted-data-payment starter. **The repo alone is not proof of successful payment.** A live Testnet transaction must be demonstrated separately.

## Updated interface and connection handling

The updated wallet cards display on-chain Testnet balances, full selectable addresses, copy buttons, and explicit refresh results. Channel creation now waits for the Bottle peer to appear in `listPeers()` and allows a short handshake grace period. This is a defensive improvement, not a guarantee that the remote Bottle node is online or that the Fiber SDK has completed protocol feature negotiation. If the Init error persists, investigate Bottle availability and SDK compatibility before retrying. Existing browser node profiles are unchanged.

## Multi-device preview build
Run `npm install` then `npm run dev`. Use the same server on both devices (HTTPS is required for browser crypto and cross-origin isolation outside localhost). Do not use a plain LAN HTTP URL for wallets. For a private test use separate Chrome profiles on localhost, or a trusted HTTPS reverse proxy preserving the isolation headers. Keep the publisher tab and node running. Studio publishes only a public preview and an encrypted single-purchase offer to the shared server's `.briefly-data/editions.json`. The buyer opens Explore or imports the offer, starts only the reader wallet, validates and pays. Each offer expires after one hour and is single-use; publish a fresh edition for another purchase. This is a single-server testnet prototype, not a production marketplace: no authentication, moderation, multi-purchase invoices, secure wallet recovery, or PDF support yet. Do not use mainnet funds. Existing browser profiles are preserved on the same origin; do not clear site data. Existing local-only offers are not migrated into the shared catalog. Use a new offer. The existing payment tests cover submission logic, not live network or the new UI.

## V4 additions
Category filters, cover themes, text/Markdown import, smart link/offer import, local purchased library and local publisher dashboard. Library stores decrypted text in browser storage; do not use for confidential documents on shared devices. Existing wallet keys are unchanged. Still single-use 1 CKB invoices with an online publisher; no production authentication or multi-buyer settlement yet. Copy the old project's `.briefly-data` folder into this project to retain existing listings. Live testnet regression testing is required.

## V5 submission update
Formatted Markdown reading and preview, clearer purchased state, dismissible messages and navigation fixes. Existing payment protocol and browser storage keys retained. Single-use invoices and online publisher requirement remain. Copy your existing .briefly-data folder into this project; keep the same localhost origin.

## V6
Single Markdown editor with paywall marker, local drafts, cover uploads, featured latest edition, live search, bookshelf. Fixed 1 CKB and single-use invoices retained. Copy existing .briefly-data separately. Payment unit tests passed; full build and live payment not verified in this environment.

## V7 activity and covers
Cover uploads default to Fit, with Fill, position and zoom controls. Featured means newest publication. Activity is saved in `.briefly-data/activity.json`; views count distinct browser identifiers, not people. Payment-key receipts validate the SHA-256 preimage and AES-GCM authentication, but are not independent proof of network settlement (a publisher already knows the key). Buyer transaction history records successful Fiber responses locally. Earlier purchases are not backfilled. Single-use 1 CKB invoices and browser-based identities remain unchanged. Do not use this prototype for real funds.

## V9 submission candidate
Import opens in a dismissible overlay. Reader and publisher wallets have separate views and histories; setup links preserve the reading or studio destination. Start the required wallet, fund it if needed, and open its channel. Publisher must remain online for settlement. Keep the existing `.briefly-data` directory and browser storage when upgrading. This is a local testnet prototype, not a production service. Live browser/Fiber verification is required before submission.

### Final onboarding update (V10)
Explore offers reader wallet setup when spending readiness is missing. Navigation displays only the testnet indicator. Offline node errors provide recovery guidance; publisher and reader remain separate testnet roles. Live payment testing is required after upgrading.
