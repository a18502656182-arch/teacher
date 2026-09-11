import { getDatabase } from "@/db";
import { ensureAuthSchema } from "@/db/auth";
import { AuthError, requireAdmin, workspaceMode } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const db = getDatabase();
    await ensureAuthSchema(db);
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = 25;
    const pattern = `%${query}%`;
    const count = await db.prepare(`SELECT COUNT(*) AS count FROM users u LEFT JOIN workspaces w ON w.owner_user_id = u.id
      WHERE ? = '' OR u.phone LIKE ? OR w.class_name LIKE ?`).bind(query, pattern, pattern).first<{ count: number }>();
    const rows = await db.prepare(`SELECT u.id, u.phone, u.status, u.created_at, u.last_login_at, u.ai_consent_at,
      w.access_token, w.class_name, w.expires_at,
      (SELECT COUNT(*) FROM devices d WHERE d.user_id = u.id AND d.status = 'active') AS active_devices
      FROM users u LEFT JOIN workspaces w ON w.owner_user_id = u.id
      WHERE ? = '' OR u.phone LIKE ? OR w.class_name LIKE ?
      ORDER BY u.created_at DESC LIMIT ? OFFSET ?`).bind(query, pattern, pattern, pageSize, (page - 1) * pageSize).all<Record<string, unknown>>();
    return Response.json(
      { users: rows.results.map((row) => ({ ...row, phone: String(row.phone), workspaceMode: workspaceMode(row.expires_at) })), total: Number(count?.count ?? 0), page, pageSize },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Admin user read failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "用户读取失败" }, { status: 500 });
  }
}
