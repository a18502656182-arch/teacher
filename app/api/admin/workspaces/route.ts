import { assertSameOrigin, AuthError, requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireAdmin(request);
    return Response.json({ error: "请通过兑换码创建用户工作台", replacement: "/api/admin/redeem-codes" }, { status: 410 });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "管理员验证失败" }, { status: 401 });
  }
}
