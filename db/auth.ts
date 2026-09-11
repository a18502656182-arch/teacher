import type { AppDatabase } from "@/db";
import { ensureWorkspaceSchema } from "@/db/workspaces";

let lastCleanupAt = 0;

export async function ensureAuthSchema(db: AppDatabase) {
  await ensureWorkspaceSchema(db);
  await db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    ai_consent_at INTEGER,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS redeem_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT NOT NULL UNIQUE,
    code_hint TEXT NOT NULL,
    code_encrypted TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    max_devices INTEGER NOT NULL DEFAULT 2,
    used_by_user_id INTEGER REFERENCES users(id),
    used_at INTEGER,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();

  const redeemColumns = await db.prepare("PRAGMA table_info(redeem_codes)").all<{ name: string }>();
  if (!redeemColumns.results.some((column) => column.name === "code_encrypted")) {
    await db.prepare("ALTER TABLE redeem_codes ADD COLUMN code_encrypted TEXT").run();
  }
  await db.prepare(`CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    device_token_hash TEXT NOT NULL UNIQUE,
    device_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    revoked_at INTEGER
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    device_id INTEGER NOT NULL REFERENCES devices(id),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    revoked_at INTEGER
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS auth_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lookup_hash TEXT NOT NULL,
    outcome TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS ai_usage_daily (
    user_id INTEGER NOT NULL REFERENCES users(id),
    usage_date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    detail TEXT,
    source_ip TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`).run();

  const workspaceColumns = await db.prepare("PRAGMA table_info(workspaces)").all<{ name: string }>();
  if (!workspaceColumns.results.some((column) => column.name === "owner_user_id")) {
    await db.prepare("ALTER TABLE workspaces ADD COLUMN owner_user_id INTEGER REFERENCES users(id)").run();
  }

  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON users(phone)").run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS redeem_codes_hash_idx ON redeem_codes(code_hash)").run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS devices_token_idx ON devices(device_token_hash)").run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id, expires_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS devices_user_idx ON devices(user_id, status)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS auth_attempts_lookup_idx ON auth_attempts(lookup_hash, created_at)").run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS workspaces_owner_idx ON workspaces(owner_user_id) WHERE owner_user_id IS NOT NULL").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_logs(created_at DESC)").run();
  await db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (2, 'authentication-and-ownership', ?)").bind(Date.now()).run();

  const now = Date.now();
  if (now - lastCleanupAt > 60 * 60 * 1000) {
    lastCleanupAt = now;
    await db.prepare("DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)").bind(now, now - 30 * 24 * 60 * 60 * 1000).run();
    await db.prepare("DELETE FROM auth_attempts WHERE created_at < ?").bind(now - 30 * 24 * 60 * 60 * 1000).run();
    const staleDeviceCutoff = now - 400 * 24 * 60 * 60 * 1000;
    await db.prepare("UPDATE devices SET status = 'revoked', revoked_at = ? WHERE status = 'active' AND last_seen_at < ?").bind(now, staleDeviceCutoff).run();
  }
}
