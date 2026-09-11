import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(),
  status: text("status").notNull().default("active"),
  aiConsentAt: integer("ai_consent_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
});

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accessToken: text("access_token").notNull().unique(),
  className: text("class_name").notNull(),
  grade: text("grade").notNull().default(""),
  term: text("term").notNull().default(""),
  status: text("status").notNull().default("active"),
  expiresAt: text("expires_at").notNull(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(1),
  ownerUserId: integer("owner_user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const workspaceVersions = sqliteTable("workspace_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  revision: integer("revision").notNull(),
  data: text("data").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const redeemCodes = sqliteTable("redeem_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  codeHash: text("code_hash").notNull().unique(),
  codeHint: text("code_hint").notNull(),
  codeEncrypted: text("code_encrypted"),
  status: text("status").notNull().default("active"),
  maxDevices: integer("max_devices").notNull().default(2),
  usedByUserId: integer("used_by_user_id").references(() => users.id),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const devices = sqliteTable("devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  deviceTokenHash: text("device_token_hash").notNull().unique(),
  deviceName: text("device_name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  deviceId: integer("device_id").notNull().references(() => devices.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
});

export const authAttempts = sqliteTable("auth_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lookupHash: text("lookup_hash").notNull(),
  outcome: text("outcome").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const aiUsageDaily = sqliteTable("ai_usage_daily", {
  userId: integer("user_id").notNull().references(() => users.id),
  usageDate: text("usage_date").notNull(),
  count: integer("count").notNull().default(0),
});

export const adminAuditLogs = sqliteTable("admin_audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  detail: text("detail"),
  sourceIp: text("source_ip").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
