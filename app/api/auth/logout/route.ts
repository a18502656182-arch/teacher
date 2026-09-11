import { appendCookies, AuthError, clearCookie, DEVICE_COOKIE, logoutCurrentDevice, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await logoutCurrentDevice(request);
    return appendCookies(Response.json({ ok: true }), [clearCookie(request, SESSION_COOKIE), clearCookie(request, DEVICE_COOKIE)]);
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: "退出失败，请稍后重试" }, { status: 500 });
  }
}
