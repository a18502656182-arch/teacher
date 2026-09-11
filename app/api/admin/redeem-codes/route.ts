import { getDatabase } from "@/db";
import { ensureAuthSchema } from "@/db/auth";
import { assertSameOrigin, AuthError, createRedeemCode, decryptRedeemCode, encryptRedeemCode, hashRedeemCode, recordAdminAudit, redeemCodeDefaults, requireAdmin } from "@/lib/auth";

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
    const count = await db.prepare(`SELECT COUNT(*) AS count FROM redeem_codes r LEFT JOIN users u ON u.id = r.used_by_user_id
      WHERE ? = '' OR r.code_hint LIKE ? OR r.status LIKE ? OR u.phone LIKE ?`).bind(query, pattern, pattern, pattern).first<{ count: number }>();
    const rows = await db.prepare(`SELECT r.id, r.code_hint, r.code_encrypted, r.status, r.max_devices, r.used_at, r.expires_at, r.created_at,
      u.phone, w.expires_at AS workspace_expires_at
      FROM redeem_codes r LEFT JOIN users u ON u.id = r.used_by_user_id
      LEFT JOIN workspaces w ON w.owner_user_id = u.id
      WHERE ? = '' OR r.code_hint LIKE ? OR r.status LIKE ? OR u.phone LIKE ?
      ORDER BY r.created_at DESC LIMIT ? OFFSET ?`).bind(query, pattern, pattern, pattern, pageSize, (page - 1) * pageSize).all<Record<string, unknown>>();
    return Response.json(
      { codes: rows.results.map((row) => ({ ...row, code_encrypted: undefined, code: decryptRedeemCode(row.code_encrypted), phone: row.phone ? String(row.phone) : "" })), total: Number(count?.count ?? 0), page, pageSize },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Admin redeem code read failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "兑换码读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireAdmin(request);
    const payload = await request.json().catch(() => ({})) as { maxDevices?: number; validDays?: number; quantity?: number; codeLength?: number };
    const defaults = redeemCodeDefaults();
    const maxDevices = Math.min(10, Math.max(1, Number(payload.maxDevices) || defaults.maxDevices));
    const validDays = Math.min(365, Math.max(1, Number(payload.validDays) || 30));
    const quantity = Math.min(50, Math.max(1, Math.floor(Number(payload.quantity) || 1)));
    const codeLength = Math.min(8, Math.max(6, Math.floor(Number(payload.codeLength) || 8)));
    const now = Date.now();
    const expiresAt = now + validDays * 24 * 60 * 60 * 1000;
    const db = getDatabase();
    await ensureAuthSchema(db);
    const codes: string[] = [];
    for (let index = 0; index < quantity; index += 1) {
      let inserted = false;
      for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
        const code = createRedeemCode(codeLength);
        try {
          await db.prepare("INSERT INTO redeem_codes (code_hash, code_hint, code_encrypted, status, max_devices, expires_at, created_at) VALUES (?, ?, ?, 'active', ?, ?, ?)")
            .bind(hashRedeemCode(code), code.slice(-4), encryptRedeemCode(code), maxDevices, expiresAt, now).run();
          codes.push(code);
          inserted = true;
        } catch (error) {
          if (attempt === 4) throw error;
        }
      }
    }
    await recordAdminAudit(request, "redeem-code.generate", "redeem-code", undefined, `quantity=${codes.length};length=${codeLength};maxDevices=${maxDevices}`);
    return Response.json({ codes, quantity: codes.length, codeLength, maxDevices, expiresAt }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Admin redeem code generation failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: error instanceof Error ? error.message : "兑换码生成失败" }, { status: 500 });
  }
}
