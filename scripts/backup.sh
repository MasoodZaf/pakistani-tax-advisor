#!/usr/bin/env bash
#
# Database backup — creates a timestamped, gzipped pg_dump of the
# tax_advisor database, writes it to $BACKUP_DIR, and prunes anything
# older than $BACKUP_RETENTION_DAYS.
#
# Intended for cron:
#   0 3 * * *  /path/to/scripts/backup.sh >> /var/log/tax_advisor_backup.log 2>&1
#
# Required env (via .env or exported by cron wrapper):
#   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
# Optional:
#   BACKUP_DIR               (default: ./backups)
#   BACKUP_RETENTION_DAYS    (default: 30)
#   BACKUP_S3_BUCKET         (if set, also upload to s3://$BACKUP_S3_BUCKET/…)

set -euo pipefail

: "${DB_HOST:?DB_HOST required}"
: "${DB_PORT:=5432}"
: "${DB_NAME:?DB_NAME required}"
: "${DB_USER:?DB_USER required}"
: "${DB_PASSWORD:?DB_PASSWORD required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/${DB_NAME}_${TS}.sql.gz"

echo "[backup] starting pg_dump → $OUT"

# --no-owner / --no-privileges keep the dump portable across hosts.
# Password supplied via PGPASSWORD so the command line doesn't leak it.
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -9 > "$OUT"

# Verify non-empty. pg_dump errors above would have set -e out; this guards
# against corrupt truncated files from interrupted runs.
if [ ! -s "$OUT" ]; then
  echo "[backup] ERROR: $OUT is empty — aborting" >&2
  rm -f "$OUT"
  exit 1
fi

SIZE_KB=$(du -k "$OUT" | awk '{print $1}')
echo "[backup] wrote $OUT (${SIZE_KB} KB)"

# Optional S3 upload.
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "[backup] WARNING: BACKUP_S3_BUCKET set but aws CLI missing; skipping upload" >&2
  else
    echo "[backup] uploading to s3://$BACKUP_S3_BUCKET/$(basename "$OUT")"
    aws s3 cp "$OUT" "s3://$BACKUP_S3_BUCKET/$(basename "$OUT")"
  fi
fi

# Retention sweep — delete dumps older than N days.
echo "[backup] pruning dumps older than ${BACKUP_RETENTION_DAYS} days"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime "+$BACKUP_RETENTION_DAYS" -print -delete

echo "[backup] done"
