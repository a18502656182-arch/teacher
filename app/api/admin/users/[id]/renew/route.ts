import { getDatabase } from "@/db";
import { ensureAuthSchema } from "@/db/auth";
import { assertSameOrigin, AuthError, recordAdminAudit, requireAdmin } from "@/lib/auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    requireAdmin(request);
    const { id } = await context.params;
    const db = getDatabase();
    await ensureAuthSchema(db);
    const workspace = await db.prepare("SELECT id, expires_at FROM workspaces WHERE owner_user_id = ?").bind(Number(id)).first<{ id: number; expires_at: string }>();
    if (!workspace) return Response.json({ error: "用户工作台不存在" }, { status: 404 });
    const current = new Date(workspace.expires_at).getTime();
    const next = new Date(Math.max(Date.now(), Number.isFinite(current) ? current : 0) + 365 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare("UPDATE workspaces SET expires_at = ?, status = 'active', updated_at = ? WHERE id = ?").bind(next, Date.now(), workspace.id).run();
    await recordAdminAudit(request, "workspace.renew", "user", id, next);
    return Response.json({ ok: true, expiresAt: next });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "续期失败" }, { status: 500 });
  }
}
