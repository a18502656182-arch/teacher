import { assertDictation } from '@/lib/dictation';
import type { ClassroomData } from '@/lib/classroom';
import { type AppDatabase, getDatabase, withDatabaseTransaction } from "@/db";
import { ensureAuthSchema } from "@/db/auth";
import { ensureWorkspaceSchema } from "@/db/workspaces";
import { defaultClassroomData } from "@/lib/classroom";
import { assertSameOrigin, authEnforced, AuthError, requireWorkspaceOwner } from "@/lib/auth";

const demoWorkspace = {
  token: "demo",
  className: "向阳小学三年级1班",
  grade: "三年级",
  term: "2026-2027学年第一学期",
  expiresAt: "2099-12-31",
};

const mojibakePattern = /[åæçèéêëìíîïðñòóôõöùúûüýĀ-ž]|�|鈥|鍚|閾|瀛|绾|鐝|涓|攢|澶|辫|触|殏|勾|湡/;
const MAX_WORKSPACE_BYTES = 5 * 1024 * 1024;

function validWorkspaceData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.students) || !Array.isArray(data.records) || !Array.isArray(data.courses)) return false;
  if (data.rosterClasses !== undefined && !Array.isArray(data.rosterClasses)) return false;
  return data.students.every((student) => {
    if (!student || typeof student !== "object" || Array.isArray(student)) return false;
    const row = student as Record<string, unknown>;
    return typeof row.id === "string" && typeof row.name === "string";
  });
}

function hasMojibake(value: unknown) {
  return typeof value === "string" && mojibakePattern.test(value);
}

function rowHasMojibake(row: Record<string, unknown>) {
  return [row.class_name, row.grade, row.term, row.data].some(hasMojibake);
}

async function upsertDemoWorkspace(db: AppDatabase) {
  const now = Date.now();
  const data = JSON.stringify(defaultClassroomData);
  await db.prepare(`
    INSERT INTO workspaces (access_token, class_name, grade, term, status, expires_at, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(access_token) DO UPDATE SET
      class_name = excluded.class_name,
      grade = excluded.grade,
      term = excluded.term,
      status = excluded.status,
      expires_at = excluded.expires_at,
      data = excluded.data,
      updated_at = excluded.updated_at
  `)
    .bind(
      demoWorkspace.token,
      demoWorkspace.className,
      demoWorkspace.grade,
      demoWorkspace.term,
      "active",
      demoWorkspace.expiresAt,
      data,
      now,
      now,
    )
    .run();
}

async function findWorkspace(token: string) {
  const db = getDatabase();
  await ensureWorkspaceSchema(db);
  await ensureAuthSchema(db);
  let row = await db.prepare("SELECT * FROM workspaces WHERE access_token = ?").bind(token).first<Record<string, unknown>>();

  if (token === demoWorkspace.token && (!row || rowHasMojibake(row))) {
    await upsertDemoWorkspace(db);
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

function demoWorkspaceResponse() {
  return Response.json({
    workspace: {
      className: demoWorkspace.className,
      grade: demoWorkspace.grade,
      term: demoWorkspace.term,
      expiresAt: demoWorkspace.expiresAt,
      revision: 1,
      data: defaultClassroomData,
    },
  });
}

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  try {
    if (token === demoWorkspace.token) return demoWorkspaceResponse();
    if (authEnforced()) {
      const access = await requireWorkspaceOwner(_, token);
      return Response.json({
        workspace: {
          className: access.workspace.class_name,
          grade: access.workspace.grade,
          term: access.workspace.term,
          expiresAt: access.workspace.expires_at,
          accessMode: access.mode,
          revision: Number(access.workspace.revision ?? 1),
          data: JSON.parse(String(access.workspace.data)),
        },
      });
    }
    const { row } = await findWorkspace(token);
    const error = accessError(row);
    if (error) return Response.json({ error }, { status: 403 });

    return Response.json({
      workspace: {
        className: row!.class_name,
        grade: row!.grade,
        term: row!.term,
        expiresAt: row!.expires_at,
        revision: Number(row!.revision ?? 1),
        data: JSON.parse(String(row!.data)),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    if (token === demoWorkspace.token) return demoWorkspaceResponse();
    return Response.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (token === demoWorkspace.token) return Response.json({ error: "演示数据不能保存" }, { status: 403 });
    assertSameOrigin(request);
    const payload = await request.json() as { data?: unknown; revision?: number };
    if (!validWorkspaceData(payload.data)) return Response.json({ error: "班级数据格式不正确" }, { status: 400 });
    const serialized = JSON.stringify(payload.data);
    if (Buffer.byteLength(serialized, "utf8") > MAX_WORKSPACE_BYTES) return Response.json({ error: "班级数据已超过 5MB，请先导出并整理历史记录" }, { status: 413 });
    const expectedRevision = Number(payload.revision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) return Response.json({ error: "缺少有效的数据版本，请重新载入页面" }, { status: 409, headers: { "Cache-Control": "no-store" } });

    const { db, row } = await findWorkspace(token);
    if (authEnforced()) await requireWorkspaceOwner(request, token, true);
    else {
      const error = accessError(row);
      if (error) return Response.json({ error }, { status: 403 });
    }

    try { assertDictation((payload.data as ClassroomData).dictation, payload.data as ClassroomData, row ? JSON.parse(String(row.data)) : undefined); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : '听写数据无效' }, { status: 400 }); }

    const saved = withDatabaseTransaction((database) => {
      const current = database.prepare("SELECT id, data, revision FROM workspaces WHERE access_token = ?").get(token) as { id: number; data: string; revision: number } | undefined;
      if (!current || Number(current.revision) !== expectedRevision) return false;
      database.prepare("INSERT OR IGNORE INTO workspace_versions (workspace_id, revision, data, created_at) VALUES (?, ?, ?, ?)").run(current.id, current.revision, current.data, Date.now());
      const result = database.prepare("UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?").run(serialized, Date.now(), current.id, expectedRevision);
      if (Number(result.changes) !== 1) return false;
      database.prepare("DELETE FROM workspace_versions WHERE workspace_id = ? AND id NOT IN (SELECT id FROM workspace_versions WHERE workspace_id = ? ORDER BY revision DESC LIMIT 20)").run(current.id, current.id);
      return true;
    });
    if (!saved) {
      const latest = await db.prepare("SELECT revision, updated_at FROM workspaces WHERE access_token = ?").bind(token).first<{ revision: number; updated_at: number }>();
      return Response.json({ error: "另一台设备已保存了更新，请载入最新数据后继续", code: "WORKSPACE_CONFLICT", revision: Number(latest?.revision ?? expectedRevision) }, { status: 409 });
    }
    return Response.json({ ok: true, revision: expectedRevision + 1 });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 });
  }
}
