import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { createAllWorkspaceFixtures, createWorkspaceFixture, fixtureScenarioIds } from './fixtures/workspace-fixtures.mjs';

const temp = await mkdtemp(path.join(tmpdir(), 'classroom-workspace-fixtures-'));
for (const name of ['classroom', 'dictation', 'workspaceBackup']) {
  const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText.replace(/from (["'])\.\/(classroom|dictation)\1/g, "from './$2.mjs'");
  await writeFile(path.join(temp, `${name}.mjs`), compiled);
}
after(() => rm(temp, { recursive: true, force: true }));
const { assertDictation } = await import(pathToFileURL(path.join(temp, 'dictation.mjs')));
const { parseWorkspaceBackup } = await import(pathToFileURL(path.join(temp, 'workspaceBackup.mjs')));

test('E0至E11场景编号完整且不会共享可变数据', () => {
  assert.deepEqual(fixtureScenarioIds, Array.from({ length: 12 }, (_, index) => `E${index}`));
  const first = createWorkspaceFixture('E1');
  const second = createWorkspaceFixture('E1');
  first.workspace.data.rosterClasses[0].students[0].name = '已修改';
  assert.notEqual(second.workspace.data.rosterClasses[0].students[0].name, '已修改');
});

test('E0正式空白且E1两班各50人身份唯一', () => {
  const empty = createWorkspaceFixture('E0').workspace.data;
  assert.equal(empty.rosterClasses.length, 1);
  assert.equal(empty.students.length, 0);
  assert.equal(empty.homeworkTasks.length, 0);
  const data = createWorkspaceFixture('E1').workspace.data;
  assert.deepEqual(data.rosterClasses.map((item) => item.students.length), [50, 50]);
  assert.equal(new Set(data.rosterClasses.flatMap((item) => item.students.map((student) => student.id))).size, 100);
});

test('E2单班105人适配长名单', () => {
  const data = createWorkspaceFixture('E2').workspace.data;
  assert.equal(data.rosterClasses.length, 1);
  assert.equal(data.students.length, 105);
  assert.equal(data.classSeatingConfigs.large.rows, 18);
});

test('E3两个重名孩子按稳定ID隔离且不进入班级名册', () => {
  const data = createWorkspaceFixture('E3').workspace.data;
  assert.deepEqual(data.dictation.children.map((item) => item.name), ['同名孩子', '同名孩子']);
  assert.equal(new Set(data.dictation.children.map((item) => item.id)).size, 2);
  assert.equal(data.rosterClasses.flatMap((item) => item.students).some((student) => student.id.startsWith('child-')), false);
  for (const task of data.dictation.tasks) assert.equal(task.context.childId, task.participants[0].id);
  assert.doesNotThrow(() => assertDictation(data.dictation, data));
});

test('E4覆盖0、3、30条作业且E5覆盖8、12、60、200词', () => {
  for (const taskCount of [0, 3, 30]) assert.equal(createWorkspaceFixture('E4', { taskCount }).workspace.data.homeworkTasks.length, taskCount);
  for (const wordCount of [8, 12, 60, 200]) {
    const data = createWorkspaceFixture('E5', { wordCount }).workspace.data;
    assert.equal(data.dictation.tasks[0].words.length, wordCount);
    assert.doesNotThrow(() => assertDictation(data.dictation, data));
  }
});

test('E6长字段保留且不使用真实身份信息', () => {
  const fixture = createWorkspaceFixture('E6');
  assert.ok(fixture.workspace.className.length > 24);
  assert.ok(fixture.workspace.data.students[0].name.length > 30);
  assert.ok(fixture.workspace.data.teacherAgenda[0].detail.length > 100);
  assert.match(JSON.stringify(fixture), /合成|边界|测试/);
});

test('E7只读、E8保存失败与E9冲突具有明确行为契约', () => {
  const readonly = createWorkspaceFixture('E7');
  assert.equal(readonly.workspace.accessMode, 'readonly');
  assert.equal(readonly.behavior.writesAllowed, false);
  assert.equal(createWorkspaceFixture('E8').behavior.saveResponse.status, 503);
  const conflict = createWorkspaceFixture('E9');
  assert.equal(conflict.workspace.revision, 2);
  assert.equal(conflict.behavior.staleRevision, 1);
  assert.equal(conflict.behavior.saveResponse.status, 409);
});

test('E10旧备份与当前备份均通过真实预检', () => {
  const fixture = createWorkspaceFixture('E10');
  assert.equal(parseWorkspaceBackup(fixture.backups.version1, Buffer.byteLength(fixture.backups.version1)).preview.students, 100);
  assert.equal(parseWorkspaceBackup(fixture.backups.version2, Buffer.byteLength(fixture.backups.version2)).preview.students, 100);
});

test('E11位于4.2至4.8MB之间且通过听写和备份校验', () => {
  const fixture = createWorkspaceFixture('E11');
  assert.ok(fixture.metadata.backupBytes >= 4.2 * 1024 * 1024);
  assert.ok(fixture.metadata.backupBytes < 4.8 * 1024 * 1024);
  assert.doesNotThrow(() => assertDictation(fixture.workspace.data.dictation, fixture.workspace.data));
  assert.equal(parseWorkspaceBackup(fixture.backups.version2, fixture.metadata.backupBytes).preview.students, 50);
});

test('全部场景可写入隔离临时SQLite并无仓库数据库路径', () => {
  const databasePath = path.join(temp, 'fixtures.db');
  const db = new DatabaseSync(databasePath);
  try {
    db.exec('CREATE TABLE fixture_workspaces(id TEXT PRIMARY KEY, token TEXT NOT NULL, payload TEXT NOT NULL);');
    const insert = db.prepare('INSERT INTO fixture_workspaces(id, token, payload) VALUES (?, ?, ?)');
    const fixtures = createAllWorkspaceFixtures();
    for (const fixture of fixtures) insert.run(fixture.id, fixture.workspace.token, JSON.stringify(fixture.workspace));
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM fixture_workspaces').get().total, 12);
    const restored = JSON.parse(db.prepare("SELECT payload FROM fixture_workspaces WHERE id = 'E1'").get().payload);
    assert.equal(restored.data.rosterClasses[1].students.length, 50);
    assert.ok(databasePath.startsWith(temp));
    assert.doesNotMatch(databasePath, /data[\\/]classroom\.db$/);
  } finally {
    db.close();
  }
});
