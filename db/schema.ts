import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accessToken: text("access_token").notNull().unique(),
  className: text("class_name").notNull(),
  grade: text("grade").notNull().default(""),
  term: text("term").notNull().default(""),
  status: text("status").notNull().default("active"),
  expiresAt: text("expires_at").notNull(),
  data: text("data").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
