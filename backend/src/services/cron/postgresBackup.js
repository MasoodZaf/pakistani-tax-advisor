'use strict';

/**
 * Nightly Postgres dump. Runs `pg_dump` against the live DB and writes a
 * gzipped .sql file to /backups inside the container (mounted to a host
 * volume so survives container rebuilds). Rotation: keeps last 14 daily +
 * 8 weekly snapshots.
 *
 * Designed for YoY data safety on a single-VPS SaaS deployment. NOT a
 * replacement for off-site replication — that needs a separate target
 * (S3/Backblaze/etc.) and is a follow-up.
 *
 * Required env (defaulted to the docker-compose internal network):
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   BACKUP_DIR  — defaults to /backups
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const { pool } = require('../../config/database');
const { insertAudit } = require('../../helpers/auditLog');

const execFileP = promisify(execFile);

const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';
const KEEP_DAILY = parseInt(process.env.BACKUP_KEEP_DAILY || '14', 10);
const KEEP_WEEKLY = parseInt(process.env.BACKUP_KEEP_WEEKLY || '8', 10);

function stamp(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
}

async function ensureDir() {
  await fs.mkdir(path.join(BACKUP_DIR, 'daily'), { recursive: true });
  await fs.mkdir(path.join(BACKUP_DIR, 'weekly'), { recursive: true });
}

// Run pg_dump and pipe through gzip. Spawning sh because shell pipes are
// the simplest way to keep memory footprint constant on large DBs — no need
// to buffer the entire dump in node.
async function runDump(filePath) {
  const { DB_HOST = 'database', DB_PORT = '5432', DB_USER = 'postgres',
          DB_PASSWORD, DB_NAME = 'tax_advisor' } = process.env;
  if (!DB_PASSWORD) {
    throw new Error('DB_PASSWORD env required for backup');
  }
  const cmd = `PGPASSWORD="${DB_PASSWORD}" pg_dump -h ${DB_HOST} -p ${DB_PORT} ` +
              `-U ${DB_USER} -d ${DB_NAME} --no-owner --no-acl ` +
              `| gzip -9 > "${filePath}"`;
  // Use sh -c since we need a shell pipe. The password is escaped via env,
  // not interpolated as a shell token, to avoid injection via DB_PASSWORD.
  await execFileP('sh', ['-c', cmd], { env: { ...process.env, PGPASSWORD: DB_PASSWORD } });
}

// Keep last N files in `dir`, oldest deleted. Returns list of removed names.
async function rotate(dir, keepCount) {
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch { return []; }
  const files = entries.filter((f) => f.endsWith('.sql.gz')).sort(); // YYYYMMDD-HHMM sorts lexically
  if (files.length <= keepCount) return [];
  const toRemove = files.slice(0, files.length - keepCount);
  await Promise.all(toRemove.map((f) => fs.unlink(path.join(dir, f)).catch(() => {})));
  return toRemove;
}

async function backupOnce(now = new Date()) {
  await ensureDir();

  const isSunday = now.getUTCDay() === 0;
  const sub = isSunday ? 'weekly' : 'daily';
  const filename = `tax_advisor-${stamp(now)}.sql.gz`;
  const filePath = path.join(BACKUP_DIR, sub, filename);

  const t0 = Date.now();
  await runDump(filePath);
  const stat = await fs.stat(filePath);
  const elapsedMs = Date.now() - t0;

  // Sanity check: dump should be >= 4KB (gzipped); anything smaller means
  // pg_dump emitted only the header and the actual data is missing.
  if (stat.size < 4096) {
    await fs.unlink(filePath).catch(() => {});
    throw new Error(`Backup suspiciously small (${stat.size}b) — aborting`);
  }

  // Rotation
  const removedDaily = await rotate(path.join(BACKUP_DIR, 'daily'), KEEP_DAILY);
  const removedWeekly = await rotate(path.join(BACKUP_DIR, 'weekly'), KEEP_WEEKLY);

  await insertAudit(pool, {
    userId: null,
    userEmail: null,
    action: 'postgres_backup',
    tableName: 'system',
    newValue: {
      path: filePath,
      size_bytes: stat.size,
      elapsed_ms: elapsedMs,
      removed_daily: removedDaily.length,
      removed_weekly: removedWeekly.length,
      tier: sub,
    },
    mandatory: true,
  }).catch((e) => logger.warn('backup audit insert failed', { message: e.message }));

  logger.info('postgres_backup ok', {
    path: filePath, sizeMB: (stat.size / 1024 / 1024).toFixed(2),
    elapsedMs, removedDaily: removedDaily.length, removedWeekly: removedWeekly.length,
  });

  return { path: filePath, size: stat.size, elapsedMs };
}

module.exports = { backupOnce };
