import { getDatabase, withDatabaseTransaction } from "@/db";
import { ensureAuthSchema } from "@/db/auth";
import { assertSameOrigin, AuthError, recordAdminAudit, requireAdmin } from "@/lib/auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) return Response.json({ error: "用户编号无效" }, { status: 400 });
    const db = getDatabase();
    await ensureAuthSchema(db);
    const user = await db.prepare("SELECT id, phone, status, ai_consent_at, created_at, last_login_at FROM users WHERE id = ?").bind(userId).first<Record<string, unknown>>();
    if (!user) return Response.json({ error: "用户不存在" }, { status: 404 });
    const workspace = await db.prepare("SELECT access_token, class_name, grade, term, status, expires_at, revision, data, created_at, updated_at FROM workspaces WHERE owner_user_id = ?").bind(userId).first<Record<string, unknown>>();
    const devices = await db.prepare("SELECT device_name, status, created_at, last_seen_at, revoked_at FROM devices WHERE user_id = ? ORDER BY created_at").bind(userId).all<Record<string, unknown>>();
    const usage = await db.prepare("SELECT usage_date, count FROM ai_usage_daily WHERE user_id = ? ORDER BY usage_date").bind(userId).all<Record<string, unknown>>();
    await recordAdminAudit(request, "user.data.export", "user", id);
    return Response.json({
      format: "classroom-user-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      user,
      workspace: workspace ? { ...workspace, data: JSON.parse(String(workspace.data)) } : null,
      devices: devices.results,
      aiUsage: usage.results,
    }, { headers: { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="classroom-user-${id}.json"` } });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "用户数据导出失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    requireAdmin(request);
    const { id } = await context.params;
    const userId = Number(id);
    const payload = await request.json() as { confirmation?: string };
    const db = getDatabase();
    await ensureAuthSchema(db);
    const user = await db.prepare("SELECT phone FROM users WHERE id = ?").bind(userId).first<{ phone: string }>();
    if (!user) return Response.json({ error: "用户不存在" }, { status: 404 });
    if (payload.confirmation !== user.phone) return Response.json({ error: "请输入该用户完整手机号确认删除" }, { status: 400 });
    withDatabaseTransaction((database) => {
      const workspace = database.prepare("SELECT id FROM workspaces WHERE owner_user_id = ?").get(userId) as { id: number } | undefined;
      database.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
      database.prepare("DELETE FROM devices WHERE user_id = ?").run(userId);
      database.prepare("DELETE FROM ai_usage_daily WHERE user_id = ?").run(userId);
      if (workspace) database.prepare("DELETE FROM workspace_versions WHERE workspace_id = ?").run(workspace.id);
      database.prepare("DELETE FROM workspaces WHERE owner_user_id = ?").run(userId);
      database.prepare("UPDATE redeem_codes SET used_by_user_id = NULL, status = 'disabled' WHERE used_by_user_id = ?").run(userId);
      database.prepare("DELETE FROM users WHERE id = ?").run(userId);
    });
    await recordAdminAudit(request, "user.data.delete", "user", id, `phone:${user.phone}`);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "用户数据删除失败" }, { status: 500 });
  }
}
