# Mobile Expense Capture — Design

**Status:** draft, pending implementation
**Last updated:** 2026-05-19
**Owner:** mobile

## What this is

The mobile app's year-round data capture surface. Users log expenses (and related
receipts) on their phone as they happen. At filing time, the captured data is
surfaced inside the web app's tax flows (deductions, adjustable tax, wealth
statement) so the user reviews/applies rather than re-entering 12 months of
records.

The mobile app is a separate codebase (`mobile/`, Expo SDK 53) talking to the
same Postgres backend as the web app, but through a **mobile-specific API
surface** at `/api/mobile/v1/*` that's designed for offline-first sync,
bandwidth-aware payloads, and resumable receipt uploads.

## Locked decisions

| Topic | Decision |
|---|---|
| Currency | **Multi-currency from day one.** Store `amount` + `currency`, plus `amount_pkr` + `fx_rate_to_pkr` for filing-time aggregation. Mobile converts at capture using a cached FX rate. |
| Multi-treatment per expense | **One tax treatment per entry.** Users with split-purpose spends create two expenses. Single `tax_treatment` column. |
| Household / shared expenses | **Single user only in v1.** Add `household_id` later if real demand appears. |
| Tax-year derivation | Derived from `occurred_on` in app code at insert. Stored as a column so it can be pinned/overridden for edge cases. |
| Receipt OCR | Not in v1. Add later as a background job. |
| Soft-delete retention | 90 days, then hard-purge. |
| Recurring expenses | Not in v1. |

## Data model

```sql
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Client-generated UUID so retried requests don't double-insert. Mobile
  -- creates this offline before the row ever reaches the server.
  client_id    UUID NOT NULL,

  -- Money (multi-currency)
  amount           NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency         CHAR(3)       NOT NULL DEFAULT 'PKR',
  fx_rate_to_pkr   NUMERIC(14,6),                   -- NULL iff currency='PKR'
  amount_pkr       NUMERIC(14,2) NOT NULL CHECK (amount_pkr >= 0),

  -- The event
  occurred_on   DATE NOT NULL,
  category      TEXT NOT NULL,
  description   TEXT,
  payee         TEXT,
  payment_method TEXT,                              -- cash|bank|card|wallet|other

  -- Tax mapping (resolved at filing time, not capture time)
  tax_year             TEXT,                        -- '2025-26'
  tax_treatment        TEXT,                        -- see enum below
  tax_section          TEXT,                        -- '60', '61', '149', …
  included_in_return   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Sync metadata
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,                          -- soft delete

  receipt_id  UUID REFERENCES receipt_files(id) ON DELETE SET NULL,

  UNIQUE (user_id, client_id),

  -- Multi-currency consistency
  CHECK (
    (currency = 'PKR' AND amount_pkr = amount AND fx_rate_to_pkr IS NULL)
    OR
    (currency <> 'PKR' AND fx_rate_to_pkr IS NOT NULL AND fx_rate_to_pkr > 0)
  )
);

CREATE TABLE receipt_files (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key  TEXT NOT NULL,                       -- e.g. receipts/<user_id>/<sha256>.jpg
  mime_type    TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  sha256       TEXT NOT NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, sha256)                          -- the same photo never stored twice per user
);
```

**Category enum** (string values, validated in app code so it can evolve):
`groceries, food_dining, transport, fuel, utilities, rent, mortgage, medical, education, insurance, zakat, charity, family_support, repairs, communication, entertainment, business_supplies, professional_fees, taxes_paid, asset_purchase, other`

**Tax treatment enum**:
`zakat, donation, medical, advance_tax, business_expense, asset_purchase, personal, unknown`

## Mobile API surface (`/api/mobile/v1/*`)

All endpoints require the existing session-token auth (`Authorization: Bearer <sessionToken>`). All accept and emit JSON unless noted. All responses include `server_now` so the client can detect clock skew.

### Versioning gate

Every mobile request must send:

```
X-App-Version: 1.0.0
```

If the version is below `MOBILE_MIN_SUPPORTED_VERSION` (env var), the server replies:

```http
HTTP/1.1 426 Upgrade Required
{ "error": "app_too_old", "minimum_version": "1.2.0", "upgrade_url": "…" }
```

Mobile shows a hard upgrade screen.

### `POST /api/mobile/v1/expenses/sync`

Batched upserts and deletes. Idempotent — retries are safe because of `(user_id, client_id)` uniqueness.

Request:

```json
{
  "changes": [
    {
      "op": "upsert",
      "client_id": "9b1d2c0a-8e30-4e51-a1ab-…",
      "amount": 1500.00,
      "currency": "PKR",
      "occurred_on": "2026-05-18",
      "category": "medical",
      "description": "Pharmacy",
      "payee": "Servaid Pharmacy",
      "payment_method": "card",
      "receipt_id": null,
      "client_updated_at": "2026-05-18T14:32:09Z"
    },
    {
      "op": "upsert",
      "client_id": "9b1d2c0b-…",
      "amount": 30.00,
      "currency": "USD",
      "fx_rate_to_pkr": 278.5,
      "amount_pkr": 8355.00,
      "occurred_on": "2026-05-15",
      "category": "professional_fees",
      "client_updated_at": "2026-05-18T14:32:10Z"
    },
    {
      "op": "delete",
      "client_id": "9b1d2c0c-…",
      "client_updated_at": "2026-05-18T14:35:00Z"
    }
  ]
}
```

Response:

```json
{
  "results": [
    {
      "client_id": "9b1d2c0a-…",
      "server_id": "e2c8a4-…",
      "status": "ok",
      "server_record": { "id": "e2c8a4-…", "updated_at": "2026-05-18T14:32:11Z", … }
    },
    {
      "client_id": "9b1d2c0b-…",
      "status": "ok",
      "server_record": { … }
    },
    {
      "client_id": "9b1d2c0c-…",
      "status": "conflict",
      "reason": "newer_on_server",
      "server_record": { … }
    }
  ],
  "server_now": "2026-05-18T14:32:11Z"
}
```

- Batch limit: **100 changes per request**. Mobile chunks larger queues.
- Conflict rule: if server's `updated_at > client_updated_at`, return `status: "conflict"` and let mobile show a resolve UI. Don't auto-discard.

### `GET /api/mobile/v1/expenses`

Delta sync, cursor-paginated.

Query: `?since=2026-05-10T00:00:00Z&limit=200&cursor=<opaque>`

Response:

```json
{
  "expenses": [ … ],
  "next_cursor": "…",
  "server_now": "2026-05-18T14:32:11Z"
}
```

- Includes soft-deleted rows so the client can prune its local copy.
- Ordered by `(updated_at, id)` ascending. Cursor is the last `(updated_at, id)` returned.
- Default `limit` 200, max 500.

### `POST /api/mobile/v1/receipts`

Multipart upload for a single receipt image (or PDF). Separate from sync — receipts are heavy and resumable, JSON metadata is light.

Request: `multipart/form-data` with one `file` part.

Response:

```json
{
  "receipt_id": "r-7c4a…",
  "sha256": "…",
  "size_bytes": 184523,
  "mime_type": "image/jpeg",
  "already_existed": false
}
```

- Server enforces: `mime_type ∈ {image/jpeg, image/png, application/pdf}`, `size_bytes ≤ 5MB`.
- Mobile downscales images to ≤1600px on the long edge before upload (keeps most under 200KB).
- `already_existed: true` when the user re-uploads the same photo (matched by sha256).
- Mobile sets `receipt_id` on the expense in its next sync batch.

### `GET /api/tax-forms/expense-suggestions` *(web app only)*

Called by the web app when the user starts/resumes a tax return. Aggregates captured expenses for the year and groups by tax treatment.

Query: `?taxYear=2025-26`

Response:

```json
{
  "by_treatment": {
    "zakat":       { "total_pkr": 50000,  "count": 5,  "expense_ids": [...] },
    "donation":    { "total_pkr": 25000,  "count": 3,  "expense_ids": [...] },
    "medical":     { "total_pkr": 180000, "count": 12, "expense_ids": [...] },
    "advance_tax": { "total_pkr": 8500,   "count": 2,  "expense_ids": [...] }
  },
  "unmapped":      { "total_pkr": 22000,  "count": 8,  "expense_ids": [...] },
  "total_captured_pkr": 285500
}
```

Web app shows the "review and apply" screen, user confirms, the existing deductions / adjustable-tax / wealth forms get pre-filled, and the backend sets `included_in_return=true` on each expense so it's not double-counted on the next return.

## Receipt storage

**Hetzner Object Storage** (S3-compatible, same datacentre as the VPS — free egress, low latency). Bucket path scheme: `receipts/<user_id>/<sha256>.<ext>`.

Cost reality check: 1,000 active users × 200 receipts/year × 200KB average ≈ 40 GB/year ≈ €0.20/month. Negligible.

Backblaze B2 or Cloudflare R2 are fine alternatives if Hetzner Object Storage doesn't fit operationally. **Don't store in Postgres `bytea`** — slow backups, expensive to read, no CDN path.

## Sync semantics (mobile-side, for reference)

1. **Capture**: user creates an expense → row inserted into local SQLite (or whatever the mobile picks) with a fresh `client_id` (UUID v4) and `pending_sync: true`.
2. **Background sync**: every N minutes (or on connectivity change), mobile collects all `pending_sync` rows and posts to `/sync`. On `ok` results, clears the flag and stores the server record. On `conflict`, surfaces a resolve UI.
3. **Pull**: on app foreground after >1h offline, or on pull-to-refresh, call `GET /expenses?since=<last_pull>`. Apply changes to local SQLite. Track `last_pull = server_now`.
4. **Receipt**: image is captured/picked → downscaled → posted to `/receipts` → returned `receipt_id` is attached to the expense locally → sync sends it on next batch.

## Open questions (not blocking the migration, but track them)

- **FX rate source.** A daily refresh from openexchangerates.org or SBP? Cache TTL? Mobile pre-fetches?
- **Push notifications.** Expo Push + which triggers (year-end reminder, uncategorised expenses, filing deadline)?
- **Cross-device install.** What happens when a user installs on a new phone — full pull, or selective?
- **Soft-delete purge job.** Cron, or on-demand?

These are v1.x concerns, not v1 blockers.
