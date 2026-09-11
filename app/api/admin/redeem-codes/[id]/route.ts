import { getDatabase } from "@/db";
import { ensureAuthSchema } from "@/db/auth";
import { assertSameOrigin, AuthError, recordAdminAudit, requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    requireAdmin(request);
    const { id } = await context.params;
    const payload = await request.json() as { status?: string; maxDevices?: number };
    const db = getDatabase();
    await ensureAuthSchema(db);
    const current = await db.prepare("SELECT * FROM redeem_codes WHERE id = ?").bind(Number(id)).first<Record<string, unknown>>();
    if (!current) return Response.json({ error: "兑换码不存在" }, { status: 404 });
    const status = payload.status === "disabled" ? "disabled" : payload.status === "active" ? "active" : String(current.status);
    const maxDevices = payload.maxDevices == null ? Number(current.max_devices) : Math.min(10, Math.max(1, Number(payload.maxDevices) || 2));
    await db.prepare("UPDATE redeem_codes SET status = ?, max_devices = ? WHERE id = ?").bind(status, maxDevices, Number(id)).run();
    await recordAdminAudit(request, "redeem-code.update", "redeem-code", id, `status=${status};maxDevices=${maxDevices}`);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "兑换码更新失败" }, { status: 500 });
  }
}
