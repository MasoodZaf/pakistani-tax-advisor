// Orchestrates push/pull between the local SQLite ledger and the backend.
//
// Push: collect rows with sync_status in ('pending','error'), chunk into
// batches of 100, POST /expenses/sync, mark each row according to result.
//
// Pull: GET /expenses?since=<last_pull>&cursor=..., apply server rows to
// SQLite via applyServerRow, then advance last_pull = server_now.
//
// No timers in this module — callers (screens, app foreground hook) decide
// when to run a sync. Keep it pull-based, not push-based, for clarity.

import { expensesAPI } from './api';
import {
  listPending,
  markSynced,
  markConflict,
  markError,
  applyServerRow,
  getSyncState,
  setSyncState,
} from './expensesDb';

const BATCH_LIMIT = 100;
const LAST_PULL_KEY = 'expenses:last_pull';

// Convert a SQLite row into the wire shape the server expects.
function rowToChange(row) {
  const isDelete = !!row.deleted_at;
  if (isDelete) {
    return {
      op: 'delete',
      client_id: row.client_id,
      client_updated_at: row.updated_at,
    };
  }
  return {
    op: 'upsert',
    client_id: row.client_id,
    client_updated_at: row.updated_at,
    amount: row.amount,
    currency: row.currency,
    fx_rate_to_pkr: row.fx_rate_to_pkr,
    amount_pkr: row.amount_pkr,
    occurred_on: row.occurred_on,
    category: row.category,
    description: row.description,
    payee: row.payee,
    payment_method: row.payment_method,
    tax_treatment: row.tax_treatment,
    tax_section: row.tax_section,
    receipt_id: row.receipt_id,
  };
}

// Push all pending writes. Resolves with a summary { pushed, conflicts, errors }.
// Throws only on the catastrophic case (network down, server 5xx). Per-row
// failures are recorded on the local row and reported via the counters.
export async function pushPending() {
  const pending = await listPending();
  if (pending.length === 0) {
    return { pushed: 0, conflicts: 0, errors: 0 };
  }

  let pushed = 0;
  let conflicts = 0;
  let errors = 0;

  for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
    const batch = pending.slice(i, i + BATCH_LIMIT);
    const changes = batch.map(rowToChange);

    let response;
    try {
      response = await expensesAPI.sync(changes);
    } catch (err) {
      // Network / server failure for the whole batch — mark each row 'error'
      // so we know to retry, then surface the failure to the caller.
      for (const row of batch) {
        await markError(row.client_id, err.message || 'network_error').catch(() => {});
      }
      throw err;
    }

    for (const result of response.results || []) {
      if (result.status === 'ok') {
        await markSynced(result.client_id, result.server_record);
        pushed += 1;
      } else if (result.status === 'conflict') {
        await markConflict(result.client_id, result.server_record);
        conflicts += 1;
      } else {
        await markError(result.client_id, result.reason || 'server_error');
        errors += 1;
      }
    }
  }

  return { pushed, conflicts, errors };
}

// Pull server-side changes since the last successful pull. Applies them to
// local SQLite. Returns { applied } for the caller's status messaging.
export async function pullDelta() {
  const since = (await getSyncState(LAST_PULL_KEY)) || new Date(0).toISOString();
  let cursor = null;
  let applied = 0;
  let serverNow = since;

  // Paginate until next_cursor is null.
  // The server caps each page at 500; we don't need to add another cap here.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await expensesAPI.pull({ since, cursor, limit: 200 });
    serverNow = page.server_now || serverNow;

    for (const row of page.expenses || []) {
      await applyServerRow(row);
      applied += 1;
    }

    cursor = page.next_cursor;
    if (!cursor) break;
  }

  // Advance the watermark. Use server_now (not local clock) so we don't miss
  // rows written between our request and response.
  await setSyncState(LAST_PULL_KEY, serverNow);

  return { applied };
}

// One-shot full sync: push first (so the server has the freshest local
// writes), then pull (so we pick up any external edits). Used by the list
// screen's pull-to-refresh and by the capture form after save.
export async function syncAll() {
  const push = await pushPending();
  const pull = await pullDelta();
  return { ...push, applied: pull.applied };
}
