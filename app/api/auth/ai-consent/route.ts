import { aiUsage, assertSameOrigin, AuthError, requireSession, setAiConsent } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession(request);
    const payload = await request.json() as { enabled?: boolean };
    await setAiConsent(session.userId, payload.enabled === true);
    return Response.json({ ok: true, enabled: payload.enabled === true, aiUsage: await aiUsage(session.userId) });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: "AI 设置保存失败" }, { status: 500 });
  }
}
