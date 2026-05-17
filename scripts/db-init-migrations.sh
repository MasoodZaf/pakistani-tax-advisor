#!/bin/bash
# Postgres init-time hook: applies every backend/database/migrations/*.sql
# in alphabetical order. Runs ONLY on first boot of a fresh data volume
# (postgres image's docker-entrypoint convention).
#
# The migrations directory is bind-mounted to /db-migrations by
# docker-compose.prod.yml. Schema.sql runs first (01-*), this runs after (02-*).
#
# psql connection params come from the container's env (POSTGRES_USER,
# POSTGRES_DB) — the entrypoint exports them for us.
set -e

MIGRATIONS_DIR=/db-migrations

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "[db-init] no migrations dir at $MIGRATIONS_DIR — skipping"
  exit 0
fi

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "[db-init] no *.sql files in $MIGRATIONS_DIR — skipping"
  exit 0
fi

echo "[db-init] applying ${#files[@]} migration files in $MIGRATIONS_DIR"
for f in "${files[@]}"; do
  echo "[db-init] >>> $(basename "$f")"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done
echo "[db-init] all migrations applied"
