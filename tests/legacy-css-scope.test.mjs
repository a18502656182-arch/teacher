import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { scopeLegacyCss } from '../scripts/legacy-css-scope.mjs';
import { transform } from 'lightningcss';
import postcss from 'postcss';
import { fileURLToPath } from 'node:url';
import { compileLegacyCss, legacyCssSources } from '../scripts/build-legacy-css.mjs';

test('隔离只修改选择器，声明内容、优先级和顺序全部保留', async () => {
  const source = await readFile(new URL('../app/workbench-repair.css', import.meta.url), 'utf8');
  const declarations = css => {
    const values = [];
    postcss.parse(css).walkDecls(decl => values.push([decl.prop, decl.value, Boolean(decl.important)]));
    return values;
  };
  const result = scopeLegacyCss(source);
  assert.deepEqual(declarations(result.css), declarations(source));
  assert.deepEqual(result.documentRules, []);
  assert.ok(result.scopedSelectors > 100);
});

test('复杂选择器和伪元素按AST限定，保留媒体与动画规则', () => {
  const source = '@media(max-width:600px){html[data-theme=campus] :is(input,textarea)::placeholder{color:red}} @keyframes busy{from{opacity:0}to{opacity:1}}';
  const result = scopeLegacyCss(source);
  assert.equal(result.scopedSelectors, 1); assert.deepEqual(result.documentRules, []);
  assert.match(result.css, /data-ui-generation/); assert.match(result.css, /next/);
  assert.match(result.css, /\)\)::placeholder/); assert.match(result.css, /@keyframes busy/);
  assert.doesNotThrow(() => transform({ filename: 'roundtrip.css', code: Buffer.from(result.css) }));
});
test('html/body/root不假装隔离，必须报告人工拆分', () => {
  const result = scopeLegacyCss(':root{--old:red}html,body{margin:0}.old{color:red}');
  assert.equal(result.documentRules.length, 3); assert.equal(result.scopedSelectors, 1);
});
test('当前旧控件CSS可完整解析作用域，全部选择器受边界限定', async () => {
  const source = await readFile(new URL('../app/components/campus/controls.css', import.meta.url), 'utf8');
  const result = scopeLegacyCss(source);
  assert.equal(result.documentRules.length, 0); assert.ok(result.scopedSelectors > 10);
  let selectors = 0;
  transform({ filename: 'controls.css', code: Buffer.from(result.css), visitor: { Rule: { style(rule) {
    for (const selector of rule.value.selectors) {
      assert.ok(selector.some(node => node.type === 'pseudo-class' && node.kind === 'where'));
      assert.ok(selector.some(node => node.type === 'pseudo-class' && node.kind === 'not'));
      selectors++;
    }
  } } } });
  assert.equal(selectors, result.scopedSelectors);
});

test('正式旧样式生成器覆盖所有源文件且不再保留document级选择器', async () => {
  const generated = await compileLegacyCss(fileURLToPath(new URL('..', import.meta.url)));
  for (const sourcePath of legacyCssSources) assert.match(generated, new RegExp(`source: ${sourcePath.replaceAll('.', '\\.')}`));
  const sheet = postcss.parse(generated);
  sheet.walkRules(rule => {
    let parent = rule.parent;
    while (parent) { if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return; parent = parent.parent; }
    assert.match(rule.selector, /data-ui-generation/);
    assert.match(rule.selector, /next/);
  });
});

test('正式布局只加载隔离产物，工作区提供legacy根且新主题提供排除根', async () => {
  const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../app/w/[token]/page.tsx', import.meta.url), 'utf8');
  const themeBoundary = await readFile(new URL('../app/components/workbench/theme/ThemeBoundary.tsx', import.meta.url), 'utf8');
  assert.match(layout, /styles\/legacy-scoped\.css/);
  for (const sourcePath of legacyCssSources) assert.doesNotMatch(layout, new RegExp(sourcePath.split('/').at(-1).replaceAll('.', '\\.')));
  assert.match(page, /data-ui-generation="legacy"/);
  assert.match(themeBoundary, /data-ui-generation="next"/);
});
