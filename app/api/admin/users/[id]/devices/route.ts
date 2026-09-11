import { getDatabase } from "@/db";
import { ensureAuthSchema } from "@/db/auth";
import { AuthError, requireAdmin } from "@/lib/auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const db = getDatabase();
    await ensureAuthSchema(db);
    const rows = await db.prepare("SELECT id, device_name, status, created_at, last_seen_at, revoked_at FROM devices WHERE user_id = ? ORDER BY created_at DESC").bind(Number(id)).all<Record<string, unknown>>();
    return Response.json({ devices: rows.results });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "设备读取失败" }, { status: 500 });
  }
}
