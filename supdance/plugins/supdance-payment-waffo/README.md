# Waffo Pancake payment plugin

This package uses the host `yingce.payment/v1` RPC contract and Node.js 20 or newer. The host owns order persistence, encrypted configuration, notification verification results and idempotent wallet crediting.

Run `sh supdance/plugins/supdance-payment-waffo/build.sh` from the repository root. This runs the RPC tests and creates a deterministic package in `.local/cache/waffo-pancake/`. Python 3 and Node.js are required; packaging does not download dependencies.

## Runtime provenance and compatible repair

`backend/rpc.cjs` was recovered from the actual installed package with SHA-256 `26ce6471b2beb3525c8a49531b3e9160ec24f5f510c99ad7b910c2333f13133d`. It includes the existing bundled Pancake SDK. The SDK, creation flow and signature verifier have not been upgraded. The provider launcher and license are copied from that package.

The November 12 repair changes inquiry to select `Payment.amount { amount currency }` and validate those two nested values. Live GraphQL introspection confirms `Money.amount` and `Money.currency` are non-null strings. The former scalar selection was rejected by the provider. Empty inquiry results remain unpaid; invalid evidence fails closed. No order cancellation or credits are inferred from elapsed time.

The compatible repair keeps plugin version `1.0.0` because historical payment orders are pinned to it. The immutable package SHA identifies the repaired artifact. The existing repository manifest also supplies `minHostVersion: 1.8.0`. Keep the original package and registry together for rollback. Never rewrite historical order or channel configuration versions to install this repair.

## Configuration and verification

Configure an HTTPS public origin, Merchant ID, Store ID, one-time Product ID, RSA private key, environment and tax category through the administration UI. Preserve existing channel configuration and old versioned notification URLs while their orders remain active. Production products must be published and support the configured currency.

The runtime supports USD and CNY and requires exact positive minor-unit amounts. It checks successful payment status, merchant reference, store, environment and product before returning payment evidence to the host. The host must match that evidence to its persisted order before crediting. Webhooks require the original signed request body and the matching environment. Browser returns alone cannot credit wallets.

Merchant-side cancellation, refunds, subscriptions and trade bill download are not implemented. An abandoned checkout can remain pending; an empty inquiry is not proof of cancellation. Test checkout creation, signed callbacks, replay, inquiry, tax/amount agreement and ledger idempotency in an isolated sandbox before claiming complete payment acceptance. The RPC fixture suite does not establish real payment settlement.
