import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { scopeLegacyCss } from '../scripts/legacy-css-scope.mjs';
import { transform } from 'lightningcss';
import postcss from 'postcss';

test('隔离只修改选择器，声明内容、优先级和顺序全部保留', async () => {
  const source = await readFile(new URL('../app/workbench-repair.css', import.meta.url), 'utf8');
  const declarations = css => {
    const values = [];
    postcss.parse(css).walkDecls(decl => values.push([decl.prop, decl.value, Boolean(decl.important)]));
    return values;
  };
  const result = scopeLegacyCss(source);
  assert.deepEqual(declarations(result.css), declarations(source));
  assert.ok(result.documentRules.length > 0);
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
