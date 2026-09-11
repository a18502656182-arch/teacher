import { assertSameOrigin, AuthError, consumeAiUsage, refundAiUsage, requireSession, workspaceForUser, workspaceMode } from "@/lib/auth";

type CommentContext = {
  score?: number;
  points?: number;
  homework?: string;
  records?: string[];
  events?: string[];
  reflections?: string[];
};

type CommentPayload = {
  workspaceToken?: string;
  studentName?: string;
  term?: string;
  style?: string;
  teacherInput?: string;
  context?: CommentContext;
};

function limitText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function listText(values: unknown, maxItems = 8) {
  if (!Array.isArray(values)) return "暂无";
  const items = values.map((item) => limitText(item, 180)).filter(Boolean).slice(0, maxItems);
  return items.length ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : "暂无";
}

export async function POST(request: Request) {
  let chargedUserId = 0;
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: "请求来源不受信任" }, { status: 403 });
  }
  let payload: CommentPayload;
  try {
    payload = await request.json() as CommentPayload;
  } catch {
    return Response.json({ error: "请求内容格式不正确。" }, { status: 400 });
  }

  if (payload.workspaceToken === "demo") {
    return Response.json({ content: "该生本学期能够认真参与课堂活动，与同学相处融洽，也在日常任务中逐渐形成责任意识。希望接下来继续保持主动表达的习惯，遇到困难时及时提问，并把学习计划落实到每天的小行动中。", demo: true });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Response.json({ error: "尚未配置 DeepSeek API Key。" }, { status: 503 });

  try {
    const session = await requireSession(request);
    if (!session.aiConsentAt) return Response.json({ error: "请先确认 AI 数据使用说明", code: "AI_CONSENT_REQUIRED" }, { status: 428 });
    const workspace = await workspaceForUser(session.userId);
    if (!workspace || workspaceMode(workspace.expires_at) !== "active") return Response.json({ error: "当前工作台暂不能使用 AI 编写" }, { status: 403 });
    if (!payload.workspaceToken) return Response.json({ error: "缺少当前工作台信息" }, { status: 400 });
    if (payload.workspaceToken !== workspace.access_token) return Response.json({ error: "无权使用此工作台数据" }, { status: 403 });
    await consumeAiUsage(session.userId);
    chargedUserId = session.userId;
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: "AI 使用状态检查失败" }, { status: 500 });
  }

  const studentName = limitText(payload.studentName, 60);
  const term = limitText(payload.term, 80);
  const style = limitText(payload.style, 30) || "家长可读";
  const teacherInput = limitText(payload.teacherInput, 1200);
  const context = payload.context ?? {};

  if (!studentName) {
    return Response.json({ error: "缺少学生信息。" }, { status: 400 });
  }

  const prompt = [
    `学生：${studentName}`,
    `学期：${term || "当前学期"}`,
    `语气：${style}`,
    `老师补充要求：${teacherInput || "请根据已有事实整理一版稳妥、具体的评语。"}`,
    `成绩：${context.score ?? "暂无"}`,
    `积分：${context.points ?? "暂无"}`,
    `作业情况：${limitText(context.homework, 100) || "暂无"}`,
    `家校沟通与成长记录：\n${listText(context.records)}`,
    `积分或日常事件：\n${listText(context.events)}`,
    `考试反思：\n${listText(context.reflections)}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [
          {
            role: "system",
            content: [
              "你是小学班主任的期末评语助手。",
              "只能依据老师提供的事实写作，不得编造学生没有出现过的经历、奖项、成绩或性格。",
              "输出一段可以直接给家长阅读的中文期末评语，不要标题、列表、引号或解释。",
              "内容要包含具体优点、真实成长和一个可执行的下一步建议。",
              "语气自然、克制、温和，避免空泛夸奖，控制在180字以内。",
            ].join(""),
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
        stream: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const result = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      if (chargedUserId) await refundAiUsage(chargedUserId);
      return Response.json({ error: result.error?.message || "DeepSeek 请求失败。" }, { status: 502 });
    }

    const content = result.choices?.[0]?.message?.content?.trim();
    if (!content) {
      if (chargedUserId) await refundAiUsage(chargedUserId);
      return Response.json({ error: "AI 没有返回可用评语。" }, { status: 502 });
    }

    return Response.json({ content: content.slice(0, 1200) });
  } catch (error) {
    if (chargedUserId) await refundAiUsage(chargedUserId).catch(() => undefined);
    return Response.json({
      error: error instanceof Error && error.name === "TimeoutError" ? "AI 服务响应超时，请稍后重试。" : error instanceof Error ? error.message : "AI 服务暂时不可用。",
    }, { status: 502 });
  }
}
