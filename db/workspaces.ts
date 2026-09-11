import type { AppDatabase } from "@/db";

export async function ensureWorkspaceSchema(db: AppDatabase) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    access_token TEXT NOT NULL UNIQUE,
    class_name TEXT NOT NULL,
    grade TEXT NOT NULL DEFAULT '',
    term TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TEXT NOT NULL,
    data TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  const columns = await db.prepare("PRAGMA table_info(workspaces)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "revision")) {
    await db.prepare("ALTER TABLE workspaces ADD COLUMN revision INTEGER NOT NULL DEFAULT 1").run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS workspaces_token_idx ON workspaces(access_token)").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS workspace_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(workspace_id, revision)
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS workspace_versions_workspace_idx ON workspace_versions(workspace_id, revision DESC)").run();
  await db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (1, 'workspace-core', ?)").bind(Date.now()).run();
  await db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (3, 'workspace-revisions', ?)").bind(Date.now()).run();
}
