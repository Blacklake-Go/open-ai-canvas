# ONE federation — staged delivery

Main remains the authority for newly admitted creative work, USD credit packages,
wallet balances and its ledger. ONE retains its original user IDs, asset paths,
legacy credit buckets, reservations, payment callbacks and immutable history.
No migration converts historical balances or adds v1 and v2 ledger totals.

## Identity and trust

Each site owns a separate Ed25519 key pair. Main knows only ONE's public key;
ONE knows only main's public key. Keys are mounted server-side and never shipped
to the browser. Both sites default disabled and require explicit user allowlists.
Existing-account linking proves both owners: ONE password and session-bound
challenge, then the active main session plus existing profile step-up policy.
Routine SSO proves the current main session and an anonymous ONE browser nonce;
ONE allocates a zero-credit ordinary shadow account only when no mapping exists.
Email and roles are never merged. Nonces are transactionally consumed once.

The fragment carries only the short-lived signed request and is erased after
reading. The assertion returns by form POST to a fixed ONE URL. It is never put
in a query string. Origins, body sizes, signatures, purposes and TTLs are checked.
Wallet/asset proofs last 30 seconds and cannot authorize identity changes.

## Read-only bridge

`/api/supdance/federation/wallet` requires an existing active main user and wallet;
it does not lazily create a wallet. `/assets` lists at most 100 confirmed owned
assets backed by ready owned media resources. `/asset` requires an asset-specific
proof and returns safe metadata or proxied bytes with Range support. No private
storage URLs, keys or provider credentials are exposed. Public sharing is the
explicit, moderated ONE publication; every media fetch still validates the source.

ONE community handoff appends plain prompt text only on a user click; it preserves
the current draft, model and pricing choices and never submits a generation.

## Deployment and rollback

Enable only after a fresh backup/restore, restored-ledger fingerprints, ownership,
replay/concurrency and same-origin browser acceptance. Store PEMs under the mounted
data directory, mode0600, outside Git. Main needs no schema migration (schema99).
ONE uses additive088/089 migrations. Roll back routing/images first; retain new
mapping/audit tables and accepted task/payment records. Never restore an old
financial dump over transactions accepted after deployment. Disable both feature
flags before changing identity mapping; a suspended mapping must not silently
fall back to a different paid wallet. Production acceptance is recorded separately
from code/test completion.
