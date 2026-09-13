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
const modalLayer = read('app/components/workbench/ui/ModalLayer.tsx');
const drawer = read('app/components/workbench/ui/Drawer.tsx');
const picker = read('app/components/workbench/ui/StudentPicker.tsx');
const pickerStyles = read('app/components/workbench/ui/student-picker.module.css');
const draftPrompt = read('app/components/workbench/ui/DraftClosePrompt.tsx');
const lookupAdapter = read('app/components/campus/StudentLookupDialog.tsx');

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

test('Dialog与Drawer共用原生top layer并支持子层焦点恢复', () => {
  assert.match(modalLayer, /element\.showModal\(\)/);
  assert.match(modalLayer, /data-workbench-dialog="next"/);
  assert.match(modalLayer, /initialFocusRef/);
  assert.match(modalLayer, /returnFocusRef/);
  assert.match(modalLayer, /triggerRef\.current/);
  assert.match(drawer, /presentation="drawer"/);
  assert.match(draftPrompt, /继续编辑/);
  assert.match(draftPrompt, /放弃修改/);
});

test('StudentPicker覆盖105人搜索、分页、跨页多选和失败保留契约', () => {
  assert.match(picker, /useDeferredValue/);
  assert.match(picker, /selectionMode === 'single' \? 'radio' : 'checkbox'/);
  assert.match(picker, /选择本页/);
  assert.match(picker, /选择全部结果/);
  assert.match(picker, /Math\.ceil\(filteredItems\.length \/ safePageSize\)/);
  assert.match(picker, /await onConfirm\(draftIds\)/);
  assert.match(picker, /setSubmitError/);
  assert.match(picker, /open && closePromptOpen/);
  assert.match(lookupAdapter, /<StudentPicker/);
  assert.match(lookupAdapter, /ThemeBoundary/);
  assert.doesNotMatch(pickerStyles, /#[0-9a-f]{3,8}|rgba?\(/i);
  assert.match(pickerStyles, /env\(safe-area-inset-bottom\)|max-width: 600px/);
});
