import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { ensureAuthSchema } from "@/db/auth";
import { getDatabase, withDatabaseTransaction } from "@/db";
import { createEmptyClassroomData } from "@/lib/classroom";

export const SESSION_COOKIE = "classroom_session";
export const DEVICE_COOKIE = "classroom_device";
export const ADMIN_COOKIE = "classroom_admin";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * DAY_MS;
const DEVICE_TTL_SECONDS = 365 * 24 * 60 * 60;
const ADMIN_TTL_SECONDS = 2 * 60 * 60;
const REDEEM_TTL_MS = 30 * DAY_MS;
const WORKSPACE_TTL_MS = 365 * DAY_MS;
const GRACE_MS = 30 * DAY_MS;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_LIMIT = 10;
const ADMIN_ATTEMPT_LIMIT = 5;
const AI_DAILY_LIMIT = 20;

export class AuthError extends Error {
  constructor(public status: number, message: string, public code = "AUTH_ERROR") {
    super(message);
  }
}

type SessionRow = {
  session_id: number;
  user_id: number;
  device_id: number;
  phone: string;
  ai_consent_at: number | null;
  session_expires_at: number;
  user_status: string;
  device_status: string;
};

export type AuthContext = {
  sessionId: number;
  userId: number;
  deviceId: number;
  phone: string;
  aiConsentAt: number | null;
};

export type WorkspaceAccess = {
  auth: AuthContext;
  workspace: Record<string, unknown>;
  mode: "active" | "readonly";
};

function envSecret(name: "AUTH_SESSION_SECRET" | "REDEEM_CODE_SECRET") {
  const value = process.env[name]?.trim();
  if (!value || value.length < 24) throw new AuthError(503, `${name} 尚未安全配置`, "AUTH_CONFIG");
  return value;
}

export function authEnforced() {
  return process.env.AUTH_ENFORCEMENT_ENABLED !== "false";
}

export function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/[\s-]/g, "");
}

export function validPhone(phone: string) {
  return /^1[3-9]\d{9}$/.test(phone);
}

export function normalizeRedeemCode(value: unknown) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function maskPhone(phone: string) {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(value: string, secretName: "AUTH_SESSION_SECRET" | "REDEEM_CODE_SECRET") {
  return createHmac("sha256", envSecret(secretName)).update(value).digest("hex");
}

export function hashRedeemCode(code: string) {
  return hmac(normalizeRedeemCode(code), "REDEEM_CODE_SECRET");
}

function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function createRedeemCode(length = 8) {
  const size = Math.min(8, Math.max(6, Math.floor(length)));
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from(randomBytes(size), (byte) => alphabet[byte % alphabet.length]).join("");
}

export function encryptRedeemCode(code: string) {
  const key = createHash("sha256").update(envSecret("REDEEM_CODE_SECRET")).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(normalizeRedeemCode(code), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptRedeemCode(value: unknown) {
  if (!value) return null;
  try {
    const [ivValue, tagValue, encryptedValue] = String(value).split(".");
    const key = createHash("sha256").update(envSecret("REDEEM_CODE_SECRET")).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function parseCookies(request: Request) {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    result.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return result;
}

function trustsProxyHeaders() {
  return process.env.AUTH_TRUST_PROXY_HEADERS === "true";
}

function requestProtocol(request: Request) {
  const forwarded = trustsProxyHeaders() ? request.headers.get("x-forwarded-proto") : null;
  return (forwarded ?? new URL(request.url).protocol.replace(":", "")).split(",")[0].trim();
}

function cookieSecurity(request: Request) {
  if (requestProtocol(request) === "https") return "; Secure";
  if (process.env.AUTH_ALLOW_INSECURE_HTTP === "true") return "";
  throw new AuthError(503, "当前站点尚未允许安全进入，请联系管理员", "INSECURE_HTTP_DISABLED");
}

function makeCookie(request: Request, name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${cookieSecurity(request)}`;
}

export function clearCookie(request: Request, name: string) {
  return makeCookie(request, name, "", 0);
}

export function appendCookies(response: Response, cookies: string[]) {
  for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
  return response;
}

export function jsonWithCookies(request: Request, body: unknown, status: number, values: Array<{ name: string; value: string; maxAge: number }>) {
  return appendCookies(Response.json(body, { status }), values.map((item) => makeCookie(request, item.name, item.value, item.maxAge)));
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new AuthError(403, "请求缺少可信来源", "ORIGIN_REQUIRED");
  const forwardedHost = trustsProxyHeaders() ? request.headers.get("x-forwarded-host") : null;
  const expectedHost = (forwardedHost ?? request.headers.get("host") ?? new URL(request.url).host).split(",")[0].trim();
  if (new URL(origin).host !== expectedHost) throw new AuthError(403, "请求来源不受信任", "ORIGIN_MISMATCH");
}

export function clientIp(request: Request) {
  if (!trustsProxyHeaders()) return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
  return (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "127.0.0.1").trim();
}

export function adminIpAllowed(request: Request) {
  const configured = (process.env.ADMIN_ALLOWED_IPS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const ip = clientIp(request);
  if (!configured.length) return ip === "127.0.0.1" || ip === "::1";
  return configured.includes("*") || configured.includes(ip);
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyAdminPassword(value: unknown) {
  const expected = process.env.ADMIN_KEY ?? "";
  return expected.length >= 8 && safeEqual(String(value ?? ""), expected);
}

export function createAdminSession(request: Request) {
  const expiresAt = Date.now() + ADMIN_TTL_SECONDS * 1000;
  const payload = `${expiresAt}.${randomToken(18)}`;
  const signature = hmac(payload, "AUTH_SESSION_SECRET");
  return { cookie: makeCookie(request, ADMIN_COOKIE, `${payload}.${signature}`, ADMIN_TTL_SECONDS), expiresAt };
}

export function requireAdmin(request: Request) {
  if (!adminIpAllowed(request)) throw new AuthError(403, "当前网络无权访问管理后台", "ADMIN_IP");
  const token = parseCookies(request).get(ADMIN_COOKIE) ?? "";
  const [expiresAt, nonce, signature] = token.split(".");
  if (!expiresAt || !nonce || !signature || Number(expiresAt) <= Date.now()) throw new AuthError(401, "管理员会话已过期", "ADMIN_SESSION");
  const payload = `${expiresAt}.${nonce}`;
  if (!safeEqual(signature, hmac(payload, "AUTH_SESSION_SECRET"))) throw new AuthError(401, "管理员会话无效", "ADMIN_SESSION");
  return { nonce, sourceIp: clientIp(request) };
}

export async function verifyAdminLogin(request: Request, password: unknown) {
  const db = getDatabase();
  await ensureAuthSchema(db);
  const key = hmac(`admin:${clientIp(request)}`, "AUTH_SESSION_SECRET");
  const cutoff = Date.now() - ATTEMPT_WINDOW_MS;
  const attempts = await db.prepare("SELECT COUNT(*) AS count FROM auth_attempts WHERE lookup_hash = ? AND created_at >= ? AND outcome = 'admin-failed'").bind(key, cutoff).first<{ count: number }>();
  if (Number(attempts?.count ?? 0) >= ADMIN_ATTEMPT_LIMIT) throw new AuthError(429, "管理员登录尝试过多，请 15 分钟后再试", "ADMIN_RATE_LIMIT");
  const valid = verifyAdminPassword(password);
  await db.prepare("INSERT INTO auth_attempts (lookup_hash, outcome, created_at) VALUES (?, ?, ?)").bind(key, valid ? "admin-success" : "admin-failed", Date.now()).run();
  return valid;
}

export async function recordAdminAudit(request: Request, action: string, targetType: string, targetId?: string | number, detail?: string) {
  const db = getDatabase();
  await ensureAuthSchema(db);
  await db.prepare("INSERT INTO admin_audit_logs (action, target_type, target_id, detail, source_ip, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(action.slice(0, 80), targetType.slice(0, 40), targetId == null ? null : String(targetId).slice(0, 80), detail ? detail.slice(0, 500) : null, clientIp(request), Date.now()).run();
}

function createSessionInTransaction(database: DatabaseSync, userId: number, deviceId: number, now: number) {
  const sessionToken = randomToken();
  database.prepare("INSERT INTO sessions (user_id, device_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, deviceId, hash(sessionToken), now + SESSION_TTL_MS, now, now);
  return sessionToken;
}

function deviceName(userAgent: string) {
  const platform = /iPad/i.test(userAgent) ? "iPad" : /iPhone/i.test(userAgent) ? "iPhone" : /Android/i.test(userAgent) ? "Android 手机" : /Windows/i.test(userAgent) ? "Windows 电脑" : /Macintosh/i.test(userAgent) ? "Mac 电脑" : "浏览器设备";
  const browser = /Edg\//i.test(userAgent) ? "Edge" : /Firefox\//i.test(userAgent) ? "Firefox" : /Chrome\//i.test(userAgent) ? "Chrome" : /Safari\//i.test(userAgent) ? "Safari" : "浏览器";
  return `${platform} · ${browser}`;
}

function attemptKeys(code: string, phone: string, ip: string) {
  return [
    hmac(`code:${code}`, "REDEEM_CODE_SECRET"),
    hmac(`phone:${phone}`, "REDEEM_CODE_SECRET"),
    hmac(`ip:${ip}`, "REDEEM_CODE_SECRET"),
  ];
}

async function recordAttempts(keys: string[], outcome: string) {
  const db = getDatabase();
  const now = Date.now();
  await Promise.all(keys.map((key) => db.prepare("INSERT INTO auth_attempts (lookup_hash, outcome, created_at) VALUES (?, ?, ?)").bind(key, outcome, now).run()));
  await db.prepare("DELETE FROM auth_attempts WHERE created_at < ?").bind(now - 30 * DAY_MS).run();
}

async function enforceAttemptLimit(keys: string[]) {
  const db = getDatabase();
  const since = Date.now() - ATTEMPT_WINDOW_MS;
  for (const key of keys) {
    const row = await db.prepare("SELECT COUNT(*) AS count FROM auth_attempts WHERE lookup_hash = ? AND outcome != 'success' AND created_at >= ?")
      .bind(key, since).first<{ count: number }>();
    if (Number(row?.count ?? 0) >= ATTEMPT_LIMIT) throw new AuthError(429, "尝试次数过多，请稍后再试", "RATE_LIMIT");
  }
}

export async function enterWithRedeemCode(request: Request, redeemCodeInput: unknown, phoneInput: unknown) {
  cookieSecurity(request);
  assertSameOrigin(request);
  const code = normalizeRedeemCode(redeemCodeInput);
  const phone = normalizePhone(phoneInput);
  if (!code || !validPhone(phone)) throw new AuthError(400, "请填写有效的兑换码和手机号", "INVALID_INPUT");

  const db = getDatabase();
  await ensureAuthSchema(db);
  const keys = attemptKeys(code, phone, clientIp(request));
  await enforceAttemptLimit(keys);

  try {
    const result = withDatabaseTransaction((database) => {
      const now = Date.now();
      const redeem = database.prepare("SELECT * FROM redeem_codes WHERE code_hash = ?").get(hashRedeemCode(code)) as Record<string, unknown> | undefined;
      const redeemUsable = redeem && (redeem.status === "active" || redeem.status === "used");
      const firstUseExpired = redeem && !redeem.used_by_user_id && Number(redeem.expires_at) < now;
      if (!redeemUsable || firstUseExpired) throw new AuthError(401, "兑换码或手机号不正确", "INVALID_REDEEM");

      let userId = Number(redeem.used_by_user_id ?? 0);
      let user = userId ? database.prepare("SELECT * FROM users WHERE id = ?").get(userId) as Record<string, unknown> | undefined : undefined;
      if (user && user.phone !== phone) throw new AuthError(401, "兑换码或手机号不正确", "INVALID_REDEEM");
      if (user && user.status !== "active") throw new AuthError(403, "当前用户已暂停使用，请联系管理员", "USER_DISABLED");

      let workspace: Record<string, unknown> | undefined;
      if (!user) {
        const existingUser = database.prepare("SELECT * FROM users WHERE phone = ?").get(phone) as Record<string, unknown> | undefined;
        if (existingUser) {
          const existingWorkspace = database.prepare("SELECT id FROM workspaces WHERE owner_user_id = ?").get(Number(existingUser.id));
          if (existingWorkspace) throw new AuthError(409, "该手机号已有工作台，请直接进入", "USER_HAS_WORKSPACE");
          userId = Number(existingUser.id);
          user = existingUser;
        } else {
          const created = database.prepare("INSERT INTO users (phone, status, created_at, last_login_at) VALUES (?, 'active', ?, ?)").run(phone, now, now);
          userId = Number(created.lastInsertRowid);
          user = database.prepare("SELECT * FROM users WHERE id = ?").get(userId) as Record<string, unknown>;
        }

        const workspaceToken = randomBytes(24).toString("hex");
        const expiresAt = new Date(now + WORKSPACE_TTL_MS).toISOString();
        database.prepare("INSERT INTO workspaces (access_token, class_name, grade, term, status, expires_at, data, owner_user_id, created_at, updated_at) VALUES (?, ?, '', '', 'active', ?, ?, ?, ?, ?)")
          .run(workspaceToken, "我的班级", expiresAt, JSON.stringify(createEmptyClassroomData()), userId, now, now);
        database.prepare("UPDATE redeem_codes SET used_by_user_id = ?, used_at = ?, status = 'used' WHERE id = ?").run(userId, now, Number(redeem.id));
        workspace = database.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").get(userId) as Record<string, unknown>;
      } else {
        workspace = database.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").get(userId) as Record<string, unknown> | undefined;
      }
      if (!workspace) throw new AuthError(500, "暂时无法创建工作台", "WORKSPACE_MISSING");

      const incomingDeviceToken = parseCookies(request).get(DEVICE_COOKIE);
      let device = incomingDeviceToken ? database.prepare("SELECT * FROM devices WHERE device_token_hash = ? AND user_id = ? AND status = 'active'").get(hash(incomingDeviceToken), userId) as Record<string, unknown> | undefined : undefined;
      let deviceToken = incomingDeviceToken ?? "";
      if (!device) {
        const activeDevices = database.prepare("SELECT COUNT(*) AS count FROM devices WHERE user_id = ? AND status = 'active'").get(userId) as { count: number };
        if (Number(activeDevices.count) >= Number(redeem.max_devices ?? 2)) {
          throw new AuthError(409, `当前兑换码已绑定 ${Number(redeem.max_devices ?? 2)} 台设备，请联系管理员解绑旧设备。`, "DEVICE_LIMIT");
        }
        deviceToken = randomToken();
        const createdDevice = database.prepare("INSERT INTO devices (user_id, device_token_hash, device_name, status, created_at, last_seen_at) VALUES (?, ?, ?, 'active', ?, ?)")
          .run(userId, hash(deviceToken), deviceName(request.headers.get("user-agent") ?? ""), now, now);
        device = database.prepare("SELECT * FROM devices WHERE id = ?").get(Number(createdDevice.lastInsertRowid)) as Record<string, unknown>;
      } else {
        database.prepare("UPDATE devices SET last_seen_at = ? WHERE id = ?").run(now, Number(device.id));
      }

      database.prepare("UPDATE sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL").run(now, Number(device.id));
      const sessionToken = createSessionInTransaction(database, userId, Number(device.id), now);
      database.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, userId);
      return { sessionToken, deviceToken, userId, deviceId: Number(device.id), workspaceToken: String(workspace.access_token), workspaceExpiresAt: String(workspace.expires_at) };
    });
    await recordAttempts(keys, "success");
    return result;
  } catch (error) {
    await recordAttempts(keys, error instanceof AuthError ? error.code : "error");
    throw error;
  }
}

export async function getSession(request: Request): Promise<AuthContext | null> {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const db = getDatabase();
  await ensureAuthSchema(db);
  const row = await db.prepare(`SELECT s.id AS session_id, s.user_id, s.device_id, s.expires_at AS session_expires_at,
      u.phone, u.ai_consent_at, u.status AS user_status, d.status AS device_status
    FROM sessions s JOIN users u ON u.id = s.user_id JOIN devices d ON d.id = s.device_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL`).bind(hash(token)).first<SessionRow>();
  if (!row || Number(row.session_expires_at) <= Date.now() || row.user_status !== "active" || row.device_status !== "active") return null;
  const now = Date.now();
  await db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(now, row.session_id).run();
  await db.prepare("UPDATE devices SET last_seen_at = ? WHERE id = ?").bind(now, row.device_id).run();
  return { sessionId: row.session_id, userId: row.user_id, deviceId: row.device_id, phone: row.phone, aiConsentAt: row.ai_consent_at };
}

export async function restoreSessionFromDevice(request: Request) {
  cookieSecurity(request);
  const deviceToken = parseCookies(request).get(DEVICE_COOKIE);
  if (!deviceToken) return null;
  const db = getDatabase();
  await ensureAuthSchema(db);
  const device = await db.prepare(`SELECT d.id, d.user_id, d.status AS device_status, u.status AS user_status
    FROM devices d JOIN users u ON u.id = d.user_id WHERE d.device_token_hash = ?`).bind(hash(deviceToken)).first<{ id: number; user_id: number; device_status: string; user_status: string }>();
  if (!device || device.device_status !== "active" || device.user_status !== "active") return null;
  const now = Date.now();
  const sessionToken = withDatabaseTransaction((database) => createSessionInTransaction(database, device.user_id, device.id, now));
  return { context: await getSession(new Request(request.url, { headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` } })), sessionToken };
}

export async function requireSession(request: Request) {
  const session = await getSession(request);
  if (!session) throw new AuthError(401, "请先进入我的工作台", "SESSION_REQUIRED");
  return session;
}

export async function workspaceForUser(userId: number) {
  const db = getDatabase();
  await ensureAuthSchema(db);
  return db.prepare("SELECT * FROM workspaces WHERE owner_user_id = ?").bind(userId).first<Record<string, unknown>>();
}

export function workspaceMode(expiresAt: unknown) {
  const expires = new Date(String(expiresAt)).getTime();
  if (!Number.isFinite(expires)) return "expired" as const;
  if (Date.now() <= expires) return "active" as const;
  if (Date.now() <= expires + GRACE_MS) return "readonly" as const;
  return "expired" as const;
}

export async function requireWorkspaceOwner(request: Request, token: string, write = false): Promise<WorkspaceAccess> {
  const auth = await requireSession(request);
  const db = getDatabase();
  const workspace = await db.prepare("SELECT * FROM workspaces WHERE access_token = ? AND owner_user_id = ?").bind(token, auth.userId).first<Record<string, unknown>>();
  if (!workspace || workspace.status !== "active") throw new AuthError(404, "工作台不存在或无权访问", "WORKSPACE_ACCESS");
  const mode = workspaceMode(workspace.expires_at);
  if (mode === "expired") throw new AuthError(403, "工作台使用期已结束，请联系管理员续期", "WORKSPACE_EXPIRED");
  if (write && mode === "readonly") throw new AuthError(403, "当前处于到期只读期，请续期后继续编辑", "WORKSPACE_READONLY");
  return { auth, workspace, mode };
}

export async function logoutCurrentDevice(request: Request) {
  assertSameOrigin(request);
  const session = await getSession(request);
  if (!session) return;
  const db = getDatabase();
  const now = Date.now();
  await db.prepare("UPDATE sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL").bind(now, session.deviceId).run();
  await db.prepare("UPDATE devices SET status = 'revoked', revoked_at = ? WHERE id = ?").bind(now, session.deviceId).run();
}

export async function setAiConsent(userId: number, enabled: boolean) {
  const db = getDatabase();
  await ensureAuthSchema(db);
  await db.prepare("UPDATE users SET ai_consent_at = ? WHERE id = ?").bind(enabled ? Date.now() : null, userId).run();
}

function shanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function aiUsage(userId: number) {
  const db = getDatabase();
  await ensureAuthSchema(db);
  const date = shanghaiDate();
  const row = await db.prepare("SELECT count FROM ai_usage_daily WHERE user_id = ? AND usage_date = ?").bind(userId, date).first<{ count: number }>();
  return { date, count: Number(row?.count ?? 0), limit: AI_DAILY_LIMIT, remaining: Math.max(0, AI_DAILY_LIMIT - Number(row?.count ?? 0)) };
}

export async function consumeAiUsage(userId: number) {
  const date = shanghaiDate();
  return withDatabaseTransaction((database) => {
    const row = database.prepare("SELECT count FROM ai_usage_daily WHERE user_id = ? AND usage_date = ?").get(userId, date) as { count: number } | undefined;
    const count = Number(row?.count ?? 0);
    if (count >= AI_DAILY_LIMIT) throw new AuthError(429, "今天的 AI 编写次数已用完，明天可以继续使用", "AI_LIMIT");
    if (row) database.prepare("UPDATE ai_usage_daily SET count = count + 1 WHERE user_id = ? AND usage_date = ?").run(userId, date);
    else database.prepare("INSERT INTO ai_usage_daily (user_id, usage_date, count) VALUES (?, ?, 1)").run(userId, date);
    return { date, count: count + 1, limit: AI_DAILY_LIMIT, remaining: AI_DAILY_LIMIT - count - 1 };
  });
}

export async function refundAiUsage(userId: number) {
  const date = shanghaiDate();
  const db = getDatabase();
  await ensureAuthSchema(db);
  await db.prepare("UPDATE ai_usage_daily SET count = MAX(0, count - 1) WHERE user_id = ? AND usage_date = ?").bind(userId, date).run();
}

export function refreshDeviceCookie(request: Request) {
  const deviceToken = parseCookies(request).get(DEVICE_COOKIE);
  return deviceToken ? makeCookie(request, DEVICE_COOKIE, deviceToken, DEVICE_TTL_SECONDS) : null;
}

export function redeemCodeDefaults() {
  return { expiresAt: Date.now() + REDEEM_TTL_MS, maxDevices: 2 };
}

export function userSessionCookies(request: Request, sessionToken: string, deviceToken: string) {
  return [
    makeCookie(request, SESSION_COOKIE, sessionToken, Math.floor(SESSION_TTL_MS / 1000)),
    makeCookie(request, DEVICE_COOKIE, deviceToken, DEVICE_TTL_SECONDS),
  ];
}
