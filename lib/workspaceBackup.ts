import type { ClassroomData } from "./classroom";

export const MAX_WORKSPACE_BACKUP_BYTES = 5 * 1024 * 1024;

export type WorkspaceBackup = {
  format: "classroom-workspace-backup";
  version: 1;
  exportedAt?: string;
  workspace?: { className?: string; grade?: string; term?: string };
  data: ClassroomData;
};

export type BackupPreview = { exportedAt: string; source: string; classes: number; students: number; records: number; exams: number };

function uniqueIds(rows: unknown, label: string) {
  if (!Array.isArray(rows)) throw new Error(`${label}格式不正确`);
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof (row as { id?: unknown }).id !== "string") throw new Error(`${label}中存在无效记录`);
    const id = (row as { id: string }).id;
    if (!id || ids.has(id)) throw new Error(`${label}中存在重复或空白 ID，无法安全恢复`);
    ids.add(id);
  }
  return ids;
}

export function parseWorkspaceBackup(text: string, byteLength: number): { backup: WorkspaceBackup; preview: BackupPreview } {
  if (byteLength > MAX_WORKSPACE_BACKUP_BYTES) throw new Error("备份文件超过 5MB，无法安全导入");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("备份文件不是有效的 JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("这不是有效的班主任工作台备份文件");
  const backup = parsed as Partial<WorkspaceBackup>;
  if (backup.format !== "classroom-workspace-backup" || backup.version !== 1 || !backup.data || typeof backup.data !== "object") throw new Error("这不是版本 1 的班主任工作台完整备份");
  const data = backup.data as ClassroomData;
  uniqueIds(data.students, "当前班级学生名单");
  if (!Array.isArray(data.records) || !Array.isArray(data.courses)) throw new Error("备份缺少沟通记录或课程数据，无法安全恢复");
  const classes = data.rosterClasses ?? [];
  uniqueIds(classes, "班级列表");
  for (const classroom of classes) {
    uniqueIds(classroom.students, `班级“${classroom.name || classroom.id}”学生名单`);
  }
  if (data.activeClassId && classes.length && !classes.some((item) => item.id === data.activeClassId)) throw new Error("备份的当前班级不存在，无法安全恢复");
  const preview: BackupPreview = {
    exportedAt: backup.exportedAt ? new Date(backup.exportedAt).toLocaleString("zh-CN") : "未记录导出时间",
    source: backup.workspace?.className || "未命名工作台",
    classes: classes.length || 1,
    students: data.students.length,
    records: data.records.length,
    exams: data.scoreExams?.length ?? 0,
  };
  return { backup: backup as WorkspaceBackup, preview };
}
