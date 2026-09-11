import { appendCookies, AuthError, enterWithRedeemCode, maskPhone, userSessionCookies } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { redeemCode?: string; phone?: string };
    const result = await enterWithRedeemCode(request, payload.redeemCode, payload.phone);
    const response = Response.json({
      ok: true,
      user: { phoneMasked: maskPhone(String(payload.phone ?? "").replace(/[\s-]/g, "")) },
      workspace: { token: result.workspaceToken, path: `/w/${result.workspaceToken}`, expiresAt: result.workspaceExpiresAt },
    }, { status: 201 });
    return appendCookies(response, userSessionCookies(request, result.sessionToken, result.deviceToken));
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : "暂时无法进入工作台" }, { status: 500 });
  }
}
