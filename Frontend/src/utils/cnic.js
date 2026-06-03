// CNIC (Pakistani National Identity Card) formatting.
//
// Canonical storage is digits-only (13 digits) — dashes are presentation, not
// data, so the DB stays clean and lookups don't depend on punctuation. The form
// shows the legit ID-card format `XXXXX-XXXXXXX-X` (5-7-1) as the user types.

/** Format any input into the CNIC mask `XXXXX-XXXXXXX-X` (tolerant of existing
 *  dashes/spaces; caps at 13 digits). Safe to run on load and on every change. */
export function formatCnic(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

/** Reduce to the canonical 13-digit form for storage/validation. */
export function stripCnic(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 13);
}

/** True when the value is a complete, valid 13-digit CNIC. */
export function isValidCnic(value) {
  return /^\d{13}$/.test(stripCnic(value));
}
