import { getDatabase } from "@/db";
import { ensureAuthSchema } from "@/db/auth";
import { AuthError, requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const db = getDatabase();
    await ensureAuthSchema(db);
    const rows = await db.prepare("SELECT id, action, target_type, target_id, detail, source_ip, created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100").all<Record<string, unknown>>();
    return Response.json({ logs: rows.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "操作记录读取失败" }, { status: 500 });
  }
}
