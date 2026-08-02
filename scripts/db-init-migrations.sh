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
#
# ---------------------------------------------------------------------------
# LC_ALL=C IS LOAD-BEARING. DO NOT REMOVE IT.
# ---------------------------------------------------------------------------
# Bash glob expansion sorts by LC_COLLATE. Under a UTF-8 locale, glibc's
# collation ignores punctuation, so `phase-t1-add-*.sql` sorts BEFORE
# `phase-t-realign-form-tables.sql`. phase-t-realign does 28 DROP/CREATE TABLE
# operations on the form tables — so running it AFTER phase-t1 destroys every
# column phase-t1 just added, and phase-u / phase-z5 then fail on the missing
# columns. Under LC_ALL=C the hyphen sorts before '1' and the order is correct.
#
# Demonstrated (glibc, debian:12):
#     LC_ALL=C          sort ->  a-b  a1b  ab   (phase-t-realign FIRST, correct)
#     LC_ALL=en_US.UTF-8 sort ->  a1b  a-b  ab   (phase-t1-*     first, destructive)
#
# This is the long-standing "fresh-init migration chain is broken" bug. Under
# LC_ALL=C the whole chain applies cleanly with zero failures.
set -e
export LC_ALL=C

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
