import { assertSameOrigin, AuthError, requireSession, workspaceForUser, workspaceMode } from "@/lib/auth";

const maxFileBytes = 12 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

type ParsedItem = {
  title?: unknown;
  subject?: unknown;
  questionNo?: unknown;
  knowledgePoint?: unknown;
  questionType?: unknown;
  maxScore?: unknown;
  confidence?: unknown;
};

const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const number = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession(request);
    if (!session.aiConsentAt) return Response.json({ error: "请先确认 AI 数据使用说明", code: "AI_CONSENT_REQUIRED" }, { status: 428 });
    const workspace = await workspaceForUser(session.userId);
    if (!workspace || workspaceMode(workspace.expires_at) !== "active") return Response.json({ error: "当前工作台暂不能使用试卷识别" }, { status: 403 });

    const form = await request.formData();
    const workspaceToken = text(form.get("workspaceToken"), 160);
    const examId = text(form.get("examId"), 160);
    const file = form.get("file");
    if (!workspaceToken || workspaceToken !== workspace.access_token) return Response.json({ error: "无权使用此工作台数据" }, { status: 403 });
    if (!examId) return Response.json({ error: "缺少关联考试" }, { status: 400 });
    if (!(file instanceof File)) return Response.json({ error: "请选择试卷文件" }, { status: 400 });
    if (file.size <= 0 || file.size > maxFileBytes) return Response.json({ error: "试卷文件需大于 0 且不超过 12MB" }, { status: 400 });
    if (!allowedTypes.has(file.type)) return Response.json({ error: "仅支持 JPG、PNG、WEBP 或 PDF 试卷" }, { status: 400 });

    const endpoint = process.env.EXAM_AI_ENDPOINT;
    const apiKey = process.env.EXAM_AI_API_KEY;
    if (!endpoint || !apiKey) return Response.json({ error: "尚未配置试卷识别服务。请由部署者设置 EXAM_AI_ENDPOINT 与 EXAM_AI_API_KEY；密钥不能填写在浏览器中。", code: "EXAM_AI_NOT_CONFIGURED" }, { status: 503 });

    const upstreamForm = new FormData();
    upstreamForm.set("file", file, file.name);
    upstreamForm.set("examId", examId);
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(60_000),
    });
    const payload = await upstream.json().catch(() => ({})) as { items?: ParsedItem[]; error?: string; message?: string };
    if (!upstream.ok) return Response.json({ error: text(payload.error || payload.message, 300) || "试卷识别服务未返回有效结果" }, { status: 502 });
    const items = (Array.isArray(payload.items) ? payload.items : []).map((item, index) => ({
      title: text(item.title, 120) || `第 ${index + 1} 题`,
      subject: text(item.subject, 40) || undefined,
      questionNo: text(item.questionNo, 20) || undefined,
      knowledgePoint: text(item.knowledgePoint, 120) || undefined,
      questionType: text(item.questionType, 60) || undefined,
      maxScore: Math.max(0.5, Math.min(500, number(item.maxScore, 1))),
      confidence: Math.max(0, Math.min(1, number(item.confidence, 0))),
    })).slice(0, 200);
    if (!items.length) return Response.json({ error: "识别服务没有返回可核对的题目。请检查服务适配器输出。" }, { status: 502 });
    return Response.json({ items, message: text(payload.message, 300) || `已识别 ${items.length} 个待核对项目` });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: error instanceof Error && error.name === "TimeoutError" ? "试卷识别超时，请稍后重试。" : "试卷识别暂时不可用。" }, { status: 500 });
  }
}
