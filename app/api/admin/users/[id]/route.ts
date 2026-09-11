import { getDatabase } from "@/db";
import { ensureAuthSchema } from "@/db/auth";
import { assertSameOrigin, AuthError, normalizePhone, recordAdminAudit, requireAdmin, validPhone } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    requireAdmin(request);
    const { id } = await context.params;
    const payload = await request.json() as { status?: string; phone?: string };
    const status = payload.status === "disabled" ? "disabled" : "active";
    const db = getDatabase();
    await ensureAuthSchema(db);
    if (payload.phone !== undefined) {
      const phone = normalizePhone(payload.phone);
      if (!validPhone(phone)) return Response.json({ error: "请输入正确的 11 位手机号" }, { status: 400 });
      const duplicate = await db.prepare("SELECT id FROM users WHERE phone = ? AND id <> ?").bind(phone, Number(id)).first<{ id: number }>();
      if (duplicate) return Response.json({ error: "该手机号已绑定其他工作台" }, { status: 409 });
      await db.prepare("UPDATE users SET phone = ? WHERE id = ?").bind(phone, Number(id)).run();
    }
    await db.prepare("UPDATE users SET status = ? WHERE id = ?").bind(status, Number(id)).run();
    if (status === "disabled") await db.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(Date.now(), Number(id)).run();
    await recordAdminAudit(request, payload.phone !== undefined ? "user.phone.update" : `user.${status}`, "user", id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "用户状态更新失败" }, { status: 500 });
  }
}
