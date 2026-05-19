// Local expense ledger (mobile-side). Mirrors the server schema closely so
// rows can be round-tripped without translation. SQLite via expo-sqlite —
// fast, supports >10k rows on commodity phones, survives uninstall/reinstall
// only if the user re-syncs from the server (no automatic backup).
//
// All writes go through this module so sync_status stays consistent.

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

// expo-sqlite (>= SDK 50) is async. The connection is cached.
let _db = null;
async function db() {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('pak_tax_advisor.db');
    await migrate(_db);
  }
  return _db;
}

// Schema mirrors backend `expenses` table, plus mobile-only sync metadata.
// We store dates as TEXT (ISO strings) — SQLite has no native date type but
// ISO strings sort correctly and pass through to the server as-is.
async function migrate(d) {
  await d.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS expenses (
      client_id        TEXT PRIMARY KEY NOT NULL,
      server_id        TEXT,
      amount           REAL NOT NULL,
      currency         TEXT NOT NULL DEFAULT 'PKR',
      fx_rate_to_pkr   REAL,
      amount_pkr       REAL NOT NULL,
      occurred_on      TEXT NOT NULL,
      category         TEXT NOT NULL,
      description      TEXT,
      payee            TEXT,
      payment_method   TEXT,
      tax_year         TEXT,
      tax_treatment    TEXT,
      tax_section      TEXT,
      included_in_return INTEGER NOT NULL DEFAULT 0,
      receipt_id       TEXT,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      deleted_at       TEXT,

      -- mobile-only sync state: 'pending' | 'synced' | 'conflict' | 'error'
      sync_status      TEXT NOT NULL DEFAULT 'pending',
      last_sync_error  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_sync ON expenses(sync_status);
    CREATE INDEX IF NOT EXISTS idx_expenses_year ON expenses(tax_year) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_expenses_occurred ON expenses(occurred_on DESC) WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS sync_state (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

// Pakistan tax year (1 July YYYY – 30 June YYYY+1 → 'YYYY-YY').
// Duplicated from the backend helper because mobile is offline-first.
export function deriveTaxYear(occurredOn) {
  const [y, m] = String(occurredOn).split('-').map(Number);
  const startYear = m >= 7 ? y : y - 1;
  const endTwo = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endTwo}`;
}

export function newClientId() {
  // Crypto.randomUUID is available on Expo SDK 53.
  return Crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

// ── CRUD ────────────────────────────────────────────────────────────────────

// Create or replace by client_id. Caller passes the user-facing fields; this
// function fills in tax_year, timestamps, and sync_status='pending'.
export async function upsertExpense(input) {
  const d = await db();
  const now = nowIso();
  const isPkr = (input.currency || 'PKR') === 'PKR';

  const row = {
    client_id: input.client_id || newClientId(),
    amount: Number(input.amount),
    currency: input.currency || 'PKR',
    fx_rate_to_pkr: isPkr ? null : Number(input.fx_rate_to_pkr),
    amount_pkr: isPkr ? Number(input.amount) : Number(input.amount_pkr),
    occurred_on: input.occurred_on,
    category: input.category,
    description: input.description ?? null,
    payee: input.payee ?? null,
    payment_method: input.payment_method ?? null,
    tax_year: input.tax_year || deriveTaxYear(input.occurred_on),
    tax_treatment: input.tax_treatment ?? null,
    tax_section: input.tax_section ?? null,
    receipt_id: input.receipt_id ?? null,
  };

  // Preserve created_at when the row already exists; always bump updated_at.
  const existing = await d.getFirstAsync(
    'SELECT created_at FROM expenses WHERE client_id = ?',
    [row.client_id]
  );

  await d.runAsync(
    `INSERT INTO expenses (
       client_id, amount, currency, fx_rate_to_pkr, amount_pkr,
       occurred_on, category, description, payee, payment_method,
       tax_year, tax_treatment, tax_section, receipt_id,
       created_at, updated_at, sync_status
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(client_id) DO UPDATE SET
       amount=excluded.amount,
       currency=excluded.currency,
       fx_rate_to_pkr=excluded.fx_rate_to_pkr,
       amount_pkr=excluded.amount_pkr,
       occurred_on=excluded.occurred_on,
       category=excluded.category,
       description=excluded.description,
       payee=excluded.payee,
       payment_method=excluded.payment_method,
       tax_year=excluded.tax_year,
       tax_treatment=excluded.tax_treatment,
       tax_section=excluded.tax_section,
       receipt_id=excluded.receipt_id,
       updated_at=excluded.updated_at,
       sync_status='pending',
       last_sync_error=NULL,
       deleted_at=NULL`,
    [
      row.client_id, row.amount, row.currency, row.fx_rate_to_pkr, row.amount_pkr,
      row.occurred_on, row.category, row.description, row.payee, row.payment_method,
      row.tax_year, row.tax_treatment, row.tax_section, row.receipt_id,
      existing?.created_at || now, now, 'pending',
    ]
  );

  return row.client_id;
}

// Soft-delete: stay in the table with deleted_at set; sync will push the
// delete to the server. After server confirms, the row stays around until
// a vacuum pass. (Vacuum is deferred until v1.x.)
export async function deleteExpense(clientId) {
  const d = await db();
  const now = nowIso();
  await d.runAsync(
    `UPDATE expenses SET deleted_at = ?, updated_at = ?, sync_status = 'pending'
     WHERE client_id = ?`,
    [now, now, clientId]
  );
}

export async function getExpense(clientId) {
  const d = await db();
  return d.getFirstAsync('SELECT * FROM expenses WHERE client_id = ?', [clientId]);
}

// Visible (non-deleted) expenses for a year, newest first.
export async function listExpensesByYear(taxYear) {
  const d = await db();
  return d.getAllAsync(
    `SELECT * FROM expenses
     WHERE tax_year = ? AND deleted_at IS NULL
     ORDER BY occurred_on DESC, created_at DESC`,
    [taxYear]
  );
}

// All visible expenses (year filter optional). Used by the list screen.
export async function listExpenses({ taxYear, limit = 200 } = {}) {
  const d = await db();
  if (taxYear) {
    return d.getAllAsync(
      `SELECT * FROM expenses
       WHERE tax_year = ? AND deleted_at IS NULL
       ORDER BY occurred_on DESC, created_at DESC
       LIMIT ?`,
      [taxYear, limit]
    );
  }
  return d.getAllAsync(
    `SELECT * FROM expenses
     WHERE deleted_at IS NULL
     ORDER BY occurred_on DESC, created_at DESC
     LIMIT ?`,
    [limit]
  );
}

// Rows the sync service needs to push.
export async function listPending() {
  const d = await db();
  return d.getAllAsync(
    `SELECT * FROM expenses WHERE sync_status IN ('pending', 'error') ORDER BY updated_at ASC`
  );
}

// Mark a row synced after the server returned ok.
export async function markSynced(clientId, serverRecord) {
  const d = await db();
  await d.runAsync(
    `UPDATE expenses SET
       server_id = ?,
       sync_status = 'synced',
       last_sync_error = NULL,
       updated_at = ?
     WHERE client_id = ?`,
    [serverRecord?.id || null, serverRecord?.updated_at || nowIso(), clientId]
  );
}

export async function markConflict(clientId, serverRecord) {
  const d = await db();
  await d.runAsync(
    `UPDATE expenses SET sync_status = 'conflict', last_sync_error = ?
     WHERE client_id = ?`,
    [`conflict: server updated_at=${serverRecord?.updated_at || 'unknown'}`, clientId]
  );
}

export async function markError(clientId, reason) {
  const d = await db();
  await d.runAsync(
    `UPDATE expenses SET sync_status = 'error', last_sync_error = ?
     WHERE client_id = ?`,
    [reason || 'unknown', clientId]
  );
}

// Apply a row pulled from the server. Inserts or updates by client_id;
// preserves local sync_status='synced' (the server's view is authoritative).
export async function applyServerRow(serverRow) {
  if (!serverRow?.client_id) return;
  const d = await db();
  await d.runAsync(
    `INSERT INTO expenses (
       client_id, server_id, amount, currency, fx_rate_to_pkr, amount_pkr,
       occurred_on, category, description, payee, payment_method,
       tax_year, tax_treatment, tax_section, included_in_return, receipt_id,
       created_at, updated_at, deleted_at, sync_status
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(client_id) DO UPDATE SET
       server_id=excluded.server_id,
       amount=excluded.amount,
       currency=excluded.currency,
       fx_rate_to_pkr=excluded.fx_rate_to_pkr,
       amount_pkr=excluded.amount_pkr,
       occurred_on=excluded.occurred_on,
       category=excluded.category,
       description=excluded.description,
       payee=excluded.payee,
       payment_method=excluded.payment_method,
       tax_year=excluded.tax_year,
       tax_treatment=excluded.tax_treatment,
       tax_section=excluded.tax_section,
       included_in_return=excluded.included_in_return,
       receipt_id=excluded.receipt_id,
       updated_at=excluded.updated_at,
       deleted_at=excluded.deleted_at,
       sync_status='synced',
       last_sync_error=NULL`,
    [
      serverRow.client_id, serverRow.id, serverRow.amount, serverRow.currency,
      serverRow.fx_rate_to_pkr, serverRow.amount_pkr,
      serverRow.occurred_on, serverRow.category, serverRow.description,
      serverRow.payee, serverRow.payment_method,
      serverRow.tax_year, serverRow.tax_treatment, serverRow.tax_section,
      serverRow.included_in_return ? 1 : 0, serverRow.receipt_id,
      serverRow.created_at, serverRow.updated_at, serverRow.deleted_at || null,
      'synced',
    ]
  );
}

// Sync state helpers (track last successful pull timestamp etc.)
export async function getSyncState(key) {
  const d = await db();
  const row = await d.getFirstAsync('SELECT value FROM sync_state WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSyncState(key, value) {
  const d = await db();
  await d.runAsync(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, value]
  );
}

// Test / dev only: wipes local data. Never call from production code.
export async function _resetLocalDb() {
  const d = await db();
  await d.execAsync('DELETE FROM expenses; DELETE FROM sync_state;');
}
