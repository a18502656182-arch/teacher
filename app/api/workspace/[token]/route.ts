import { getD1 } from "@/db";
import { defaultClassroomData } from "@/lib/classroom";

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token TEXT NOT NULL UNIQUE,
      class_name TEXT NOT NULL,
      grade TEXT NOT NULL DEFAULT '',
      term TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS workspaces_token_idx ON workspaces(access_token)"),
  ]);
}

async function findWorkspace(token: string) {
  const db = getD1();
  await ensureSchema(db);
  let row = await db.prepare("SELECT * FROM workspaces WHERE access_token = ?").bind(token).first<Record<string, unknown>>();
  if (!row && token === "demo") {
    const now = Date.now();
    await db.prepare("INSERT INTO workspaces (access_token, class_name, grade, term, status, expires_at, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("demo", "向阳小学三年级2班", "三年级", "2026—2027学年第一学期", "active", "2099-12-31", JSON.stringify(defaultClassroomData), now, now).run();
    row = await db.prepare("SELECT * FROM workspaces WHERE access_token = ?").bind(token).first<Record<string, unknown>>();
  }
  return { db, row };
}

function accessError(row: Record<string, unknown> | null) {
  if (!row) return "链接不存在或已被撤销";
  if (row.status !== "active") return "此链接已暂停使用";
  if (new Date(String(row.expires_at)).getTime() < Date.now()) return "此链接已经到期";
  return null;
}

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const { row } = await findWorkspace(token);
    const error = accessError(row);
    if (error) return Response.json({ error }, { status: 403 });
    return Response.json({
      workspace: {
        className: row!.class_name,
        grade: row!.grade,
        term: row!.term,
        expiresAt: row!.expires_at,
        data: JSON.parse(String(row!.data)),
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const payload = await request.json() as { data?: unknown };
    if (!payload.data) return Response.json({ error: "缺少班级数据" }, { status: 400 });
    const { db, row } = await findWorkspace(token);
    const error = accessError(row);
    if (error) return Response.json({ error }, { status: 403 });
    await db.prepare("UPDATE workspaces SET data = ?, updated_at = ? WHERE access_token = ?")
      .bind(JSON.stringify(payload.data), Date.now(), token).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 });
  }
}
