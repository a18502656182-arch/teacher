import { getDatabase } from "@/db";
import { ensureWorkspaceSchema } from "@/db/workspaces";
import { authEnforced, AuthError, requireWorkspaceOwner } from "@/lib/auth";
import knowledge from "@/data/knowledge-items.json";

type KnowledgeItem = {
  id: string;
  title: string;
  category: string;
  path: string;
  extension: string;
  size: number;
  content: string;
};

const items = knowledge as KnowledgeItem[];

async function canAccess(token: string) {
  const db = getDatabase();
  await ensureWorkspaceSchema(db);
  const row = await db.prepare("SELECT status, expires_at FROM workspaces WHERE access_token = ?").bind(token).first<{ status: string; expires_at: string }>();
  if (!row || row.status !== "active") return false;
  return new Date(row.expires_at).getTime() >= Date.now();
}

function makeExcerpt(content: string, query: string) {
  const plain = content.replace(/\s+/g, " ").trim();
  if (!query) return `${plain.slice(0, 155)}${plain.length > 155 ? "…" : ""}`;
  const index = plain.toLocaleLowerCase("zh-CN").indexOf(query.toLocaleLowerCase("zh-CN"));
  const start = Math.max(0, index < 0 ? 0 : index - 45);
  const excerpt = plain.slice(start, start + 190);
  return `${start > 0 ? "…" : ""}${excerpt}${start + 190 < plain.length ? "…" : ""}`;
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (token !== "demo") {
      if (authEnforced()) await requireWorkspaceOwner(request, token);
      else if (!(await canAccess(token))) return Response.json({ error: "链接无权访问资料库" }, { status: 403 });
    }
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const item = items.find((entry) => entry.id === id);
      if (!item) return Response.json({ error: "资料不存在" }, { status: 404 });
      return Response.json({ item });
    }

    const query = (url.searchParams.get("q") ?? "").trim();
    const category = (url.searchParams.get("category") ?? "").trim();
    const lowered = query.toLocaleLowerCase("zh-CN");
    const filtered = items.filter((item) => {
      if (category && item.category !== category) return false;
      if (!lowered) return true;
      return item.title.toLocaleLowerCase("zh-CN").includes(lowered) || item.content.toLocaleLowerCase("zh-CN").includes(lowered);
    });
    const ranked = [...filtered].sort((a, b) => {
      if (!lowered) return a.title.localeCompare(b.title, "zh-CN");
      const aTitle = a.title.toLocaleLowerCase("zh-CN").includes(lowered) ? 1 : 0;
      const bTitle = b.title.toLocaleLowerCase("zh-CN").includes(lowered) ? 1 : 0;
      return bTitle - aTitle || a.title.localeCompare(b.title, "zh-CN");
    });
    const categoryMap = new Map<string, number>();
    for (const item of items) categoryMap.set(item.category, (categoryMap.get(item.category) ?? 0) + 1);
    const categories = [...categoryMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
    return Response.json({
      total: ranked.length,
      categories,
      items: ranked.slice(0, 30).map((item) => ({ id: item.id, title: item.title, category: item.category, extension: item.extension, path: item.path, excerpt: makeExcerpt(item.content, query) })),
    });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : "资料检索失败" }, { status: 500 });
  }
}
