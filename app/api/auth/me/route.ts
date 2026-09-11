import { aiUsage, appendCookies, AuthError, clearCookie, getSession, jsonWithCookies, refreshDeviceCookie, restoreSessionFromDevice, SESSION_COOKIE, workspaceForUser, workspaceMode } from "@/lib/auth";
import { getDatabase } from "@/db";

export async function GET(request: Request) {
  try {
    let session = await getSession(request);
    let restoredToken = "";
    if (!session) {
      const restored = await restoreSessionFromDevice(request);
      session = restored?.context ?? null;
      restoredToken = restored?.sessionToken ?? "";
    }
    if (!session) return appendCookies(Response.json({ error: "尚未进入工作台" }, { status: 401 }), [clearCookie(request, SESSION_COOKIE)]);

    const workspace = await workspaceForUser(session.userId);
    if (!workspace) return Response.json({ error: "当前用户还没有工作台" }, { status: 404 });
    const mode = workspaceMode(workspace.expires_at);
    if (mode === "expired") return Response.json({ error: "工作台使用期已结束，请联系管理员续期" }, { status: 403 });
    const db = getDatabase();
    const device = await db.prepare("SELECT id, device_name, last_seen_at FROM devices WHERE id = ?").bind(session.deviceId).first<{ id: number; device_name: string; last_seen_at: number }>();
    const usage = await aiUsage(session.userId);
    const body = {
      user: { id: session.userId, phone: session.phone, aiConsent: Boolean(session.aiConsentAt) },
      workspace: { token: String(workspace.access_token), path: `/w/${String(workspace.access_token)}`, className: String(workspace.class_name), expiresAt: String(workspace.expires_at), mode },
      device: { id: session.deviceId, name: device?.device_name ?? "当前设备", lastSeenAt: device?.last_seen_at ?? Date.now() },
      aiUsage: usage,
    };
    const sessionCookies = restoredToken ? [{ name: SESSION_COOKIE, value: restoredToken, maxAge: 30 * 24 * 60 * 60 }] : [];
    const response = sessionCookies.length ? jsonWithCookies(request, body, 200, sessionCookies) : Response.json(body);
    const deviceCookie = refreshDeviceCookie(request);
    return deviceCookie ? appendCookies(response, [deviceCookie]) : response;
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : "身份检查失败" }, { status: 500 });
  }
}
