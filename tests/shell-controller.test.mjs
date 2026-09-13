import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/components/workbench/shell/history.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { popModuleTrail, pushModuleTrail } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const catalogSource = await readFile(new URL('../app/components/workbench/shell/catalog.ts', import.meta.url), 'utf8');
const catalogOutput = ts.transpileModule(catalogSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { mobileMoreGroups, mobilePrimaryModules, workspaceModules, workspaceNavGroups } = await import(`data:text/javascript;base64,${Buffer.from(catalogOutput).toString('base64')}`);

test('手机模块历史连续返回且返回不会新增历史项', () => {
  let trail = ['dashboard'];
  trail = pushModuleTrail(trail, 'students');
  trail = pushModuleTrail(trail, 'homework');
  assert.deepEqual(trail, ['dashboard', 'students', 'homework']);

  let back = popModuleTrail(trail);
  assert.equal(back.target, 'students');
  assert.deepEqual(back.trail, ['dashboard', 'students']);
  back = popModuleTrail(back.trail);
  assert.equal(back.target, 'dashboard');
  assert.deepEqual(back.trail, ['dashboard']);
  assert.deepEqual(popModuleTrail(back.trail), { trail: ['dashboard'], target: 'dashboard' });
});

test('浏览器前进与替换可重建当前模块轨迹', () => {
  assert.deepEqual(pushModuleTrail(['dashboard', 'students'], 'homework'), ['dashboard', 'students', 'homework']);
  assert.deepEqual(pushModuleTrail(['dashboard', 'students'], 'growth', true), ['dashboard', 'growth']);
  assert.deepEqual(pushModuleTrail(['dashboard'], 'dashboard'), ['dashboard']);
});

test('四组目录覆盖19模块且更多只包含底栏之外15项', () => {
  const all = workspaceNavGroups.flatMap(group => group.items);
  const primary = mobilePrimaryModules.map(item => item.id);
  const more = mobileMoreGroups.flatMap(group => group.items);
  assert.equal(workspaceModules.length, 19);
  assert.equal(workspaceNavGroups.length, 4);
  assert.equal(new Set(all).size, 19);
  assert.equal(more.length, 15);
  assert.deepEqual(more.filter(id => primary.includes(id)), []);
  assert.deepEqual(new Set([...primary, ...more]), new Set(all));
});
