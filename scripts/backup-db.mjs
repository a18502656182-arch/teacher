import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const source = resolve(process.env.CLASSROOM_DB_PATH || "data/classroom.db");
const backupDir = resolve(process.env.CLASSROOM_BACKUP_DIR || "backups");
const retention = Math.max(3, Math.min(90, Number(process.env.CLASSROOM_BACKUP_RETENTION || 14)));
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const target = join(backupDir, `classroom-${stamp}.db`);

mkdirSync(backupDir, { recursive: true });
const database = new DatabaseSync(isAbsolute(source) ? source : resolve(source), { readOnly: true });
database.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
database.close();

const verification = new DatabaseSync(target, { readOnly: true });
const quickCheck = verification.prepare("PRAGMA quick_check").get();
const workspaceCount = verification.prepare("SELECT COUNT(*) AS count FROM workspaces").get();
verification.close();
if (quickCheck.integrity_check !== "ok" && quickCheck.quick_check !== "ok") throw new Error("备份完整性校验失败");

const backups = readdirSync(backupDir).filter((name) => /^classroom-\d{8}T\d{6}Z\.db$/.test(name)).sort().reverse();
for (const expired of backups.slice(retention)) rmSync(join(backupDir, expired), { force: true });

console.log(`Backup verified: ${target}`);
console.log(`Workspaces: ${Number(workspaceCount.count ?? 0)}; retained: ${Math.min(backups.length, retention)}`);
