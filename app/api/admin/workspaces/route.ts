import { env } from "cloudflare:workers";
import { getD1 } from "@/db";
import { defaultClassroomData } from "@/lib/classroom";

export async function POST(request: Request) {
  const adminKey = request.headers.get("x-admin-key");
  const expected = typeof env.ADMIN_KEY === "string" ? env.ADMIN_KEY : "";
  if (!expected || adminKey !== expected) return Response.json({ error: "管理员验证失败" }, { status: 401 });
  const payload = await request.json() as { className?: string; grade?: string; term?: string; expiresAt?: string };
  if (!payload.className || !payload.expiresAt) return Response.json({ error: "请填写班级名称和到期日" }, { status: 400 });
  const db = getD1();
  await db.prepare(`CREATE TABLE IF NOT EXISTS workspaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    access_token TEXT NOT NULL UNIQUE,
    class_name TEXT NOT NULL,
    grade TEXT NOT NULL DEFAULT '',
    term TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  const token = crypto.randomUUID().replaceAll("-", "");
  const now = Date.now();
  await db.prepare("INSERT INTO workspaces (access_token, class_name, grade, term, status, expires_at, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(token, payload.className.trim(), payload.grade?.trim() ?? "", payload.term?.trim() ?? "", "active", payload.expiresAt, JSON.stringify(defaultClassroomData), now, now).run();
  return Response.json({ token, path: `/w/${token}` }, { status: 201 });
}
