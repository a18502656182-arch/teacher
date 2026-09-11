import { adminIpAllowed, appendCookies, assertSameOrigin, AuthError, clearCookie, createAdminSession, ADMIN_COOKIE, requireAdmin, verifyAdminLogin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return Response.json({ authenticated: true });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ authenticated: false, error: error.message }, { status: error.status });
    return Response.json({ authenticated: false }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!adminIpAllowed(request)) throw new AuthError(403, "当前网络无权访问管理后台", "ADMIN_IP");
    const payload = await request.json() as { password?: string };
    if (!await verifyAdminLogin(request, payload.password)) throw new AuthError(401, "管理员密码不正确", "ADMIN_PASSWORD");
    const session = createAdminSession(request);
    return appendCookies(Response.json({ authenticated: true, expiresAt: session.expiresAt }), [session.cookie]);
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    console.error("Admin session creation failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "管理员登录失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    return appendCookies(Response.json({ ok: true }), [clearCookie(request, ADMIN_COOKIE)]);
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "退出失败" }, { status: 500 });
  }
}
