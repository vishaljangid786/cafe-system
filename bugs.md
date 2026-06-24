# CafeOS — Bugs

_No open bugs._ ✅

## Testing phase (2026-06-24)
Added a real integration test suite (`npm run test:int`) running against an in-memory MongoDB
replica set (`mongodb-memory-server`) — it drives the actual models/services. This caught **two
critical production bugs that static analysis / the module-load smoke test could NOT**:

1. **Mongoose 9 pipeline-update break (CRITICAL).** The app uses Mongoose `^9.4.1`, where passing an
   array (aggregation pipeline) to `findOneAndUpdate` now throws unless `{ updatePipeline: true }`.
   `finalizeOrder` (the order-completion claim) and the invoice-number increment both use pipeline
   updates → they would have **crashed on every order completion, bill, and invoice** in production.
   Fixed in `utils/orderFinalizer.js` and `controllers/orderController.js`.
2. **`Transaction.paymentType` enum missing `GIFT_CARD` (CRITICAL).** Completing a gift-card-settled
   order made `finalizeOrder` create a REVENUE `Transaction` with `paymentType: 'GIFT_CARD'`, which
   failed model validation → **finalize crashed** for any gift-card order. Fixed in `models/Transaction.js`.

Tests (6/6 pass) cover: settings `num()`/loyalty tiers, order create→finalize money math (GST,
grandTotal, stock, revenue), discountedPrice honored, modifier pricing + required enforcement +
anti-tamper/dedupe, and gift-card redeem (true payable, outstanding cap) → refund balance restore.

> Note: earlier static-audit findings are all resolved (booking↔reservation capacity, waitlist
> seat→table, reservation no-show, notification "all"-role, duplicate socket). Two flagged theme
> items were verified intentional. Three items accepted/deferred by design (payment-event ledger,
> intentional theme tokens, benign lint warnings).
>
> Still outstanding (environment limit): testing against the **real production DB** — the configured
> `MONGO_URI` is an unreachable placeholder. The in-memory suite is the closest substitute here.
