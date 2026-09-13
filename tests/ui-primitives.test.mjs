import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const button = read('app/components/workbench/ui/Button.tsx');
const field = read('app/components/workbench/ui/Field.tsx');
const segment = read('app/components/workbench/ui/StatusSegment.tsx');
const selection = read('app/components/workbench/ui/SelectionBar.tsx');
const menu = read('app/components/workbench/ui/Menu.tsx');
const feedback = read('app/components/workbench/ui/FeedbackState.tsx');
const styles = read('app/components/workbench/ui/controls.module.css');

test('按钮busy与disabled共享不可重复触发语义且保留原生类型', () => {
  assert.match(button, /type = 'button'/);
  assert.match(button, /disabled=\{disabled \|\| busy\}/);
  assert.match(button, /aria-busy=\{busy \|\| undefined\}/);
  assert.match(button, /data-busy=\{busy \|\| undefined\}/);
  assert.match(button, /styles\.spinner/);
});

test('字段标签、提示和错误建立真实可访问关系', () => {
  assert.match(field, /<label htmlFor=\{id\}>/);
  assert.match(field, /id=\{`\$\{id\}-hint`\}/);
  assert.match(field, /id=\{`\$\{id\}-error`\}[^>]+role="alert"/);
  assert.match(field, /aria-describedby=\{description/);
  assert.match(field, /aria-invalid=\{Boolean\(error\)/);
});

test('状态分段、批量条和菜单使用各自的交互语义', () => {
  assert.match(segment, /role="group" aria-label=\{label\}/);
  assert.match(segment, /aria-pressed=\{value === option\.value\}/);
  assert.match(selection, /role="region" aria-label="批量操作"/);
  assert.match(selection, /aria-live="polite"/);
  assert.match(menu, /aria-haspopup="menu"/);
  assert.match(menu, /role="menu"/);
  assert.match(menu, /role="menuitem"/);
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Tab']) assert.match(menu, new RegExp(`'${key}'`));
  assert.match(menu, /document\.addEventListener\('pointerdown'/);
});

test('加载与空态不生成业务结果并保留文字替代', () => {
  assert.match(feedback, /role="status" aria-live="polite"/);
  assert.match(feedback, /aria-labelledby=\{titleId\} aria-describedby=\{descriptionId\}/);
  assert.match(feedback, /Artwork role=\{artworkRole\}/);
  assert.match(feedback, /empty\.no-results/);
});

test('基础控件样式只消费主题变量并处理长文本、窄屏和减少动态', () => {
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}|rgba?\(/i);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /@media \(max-width: 600px\)/);
});
