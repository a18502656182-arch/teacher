import { getDatabase } from "@/db";
import { ensureAuthSchema } from "@/db/auth";
import { assertSameOrigin, AuthError, recordAdminAudit, requireAdmin } from "@/lib/auth";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    requireAdmin(request);
    const { id } = await context.params;
    const db = getDatabase();
    await ensureAuthSchema(db);
    const now = Date.now();
    await db.prepare("UPDATE sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL").bind(now, Number(id)).run();
    await db.prepare("UPDATE devices SET status = 'revoked', revoked_at = ? WHERE id = ?").bind(now, Number(id)).run();
    await recordAdminAudit(request, "device.revoke", "device", id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "设备解绑失败" }, { status: 500 });
  }
}
