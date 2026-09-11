import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

type BindValue = string | number | bigint | null | Uint8Array;

class SqliteStatement {
  private values: BindValue[] = [];
  private readonly statement: ReturnType<DatabaseSync["prepare"]>;

  constructor(statement: ReturnType<DatabaseSync["prepare"]>) {
    this.statement = statement;
  }

  bind(...values: BindValue[]) {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>() {
    return (this.statement.get(...this.values) ?? null) as T | null;
  }

  async all<T = Record<string, unknown>>() {
    return { results: this.statement.all(...this.values) as T[] };
  }

  async run() {
    const result = this.statement.run(...this.values);
    return {
      success: true,
      meta: {
        changes: result.changes,
        last_row_id: result.lastInsertRowid,
      },
    };
  }
}

export type AppDatabase = {
  prepare(sql: string): SqliteStatement;
  batch(statements: SqliteStatement[]): Promise<unknown[]>;
};

let database: DatabaseSync | null = null;

function resolveDatabasePath() {
  const configured = process.env.CLASSROOM_DB_PATH || "data/classroom.db";
  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

function openDatabase() {
  if (database) return database;
  const databasePath = resolveDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec("PRAGMA foreign_keys = ON");
  return database;
}

export function getDatabase(): AppDatabase {
  const db = openDatabase();
  return {
    prepare(sql: string) {
      return new SqliteStatement(db.prepare(sql));
    },
    async batch(statements: SqliteStatement[]) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  };
}

export function withDatabaseTransaction<T>(callback: (database: DatabaseSync) => T): T {
  const activeDatabase = openDatabase();
  activeDatabase.exec("BEGIN IMMEDIATE");
  try {
    const result = callback(activeDatabase);
    activeDatabase.exec("COMMIT");
    return result;
  } catch (error) {
    activeDatabase.exec("ROLLBACK");
    throw error;
  }
}
