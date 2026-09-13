import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const contracts = read('app/components/workbench/theme/contracts.ts');
const definitions = read('app/components/workbench/theme/definitions.ts').replace(/^import .*from '\.\/contracts';\r?\n/m, '');
const cssVariables = read('app/components/workbench/theme/cssVariables.ts').replace(/^import .*\r?\n/gm, '');
const runtimeSource = [contracts, definitions, cssVariables].join('\n');
const { outputText } = ts.transpileModule(runtimeSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const runtime = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('公开主题固定为校园，玻璃仅保留完整内部token且不借用校园插画', () => {
  assert.equal(runtime.resolvePublicTheme(), 'campus');
  assert.equal(runtime.publicThemeDefinition, runtime.campusTheme);
  assert.equal(runtime.campusTheme.status, 'development');
  assert.equal(runtime.glassTheme.status, 'planned');
  assert.equal(runtime.glassTheme.capabilities.blur, false);
  assert.deepEqual(runtime.glassTheme.artworkByRole, {});
  for (const theme of [runtime.campusTheme, runtime.glassTheme]) {
    for (const key of ['semanticColors', 'surfaces', 'typography', 'spacing', 'radii', 'elevation', 'motion', 'artworkByRole', 'capabilities']) {
      assert.ok(theme[key], `${theme.id} missing ${key}`);
    }
    assert.equal(theme.surfaces.colorScheme, 'light');
    assert.equal(theme.capabilities.reducedMotion, true);
  }
});

test('所有共享CSS token都由主题定义或边界别名明确提供', () => {
  const produced = new Set(Object.keys(runtime.themeCssVariables(runtime.campusTheme)));
  const aliases = new Set(['--wb-work', '--wb-material-blur', '--wb-motion-duration', '--wb-heading']);
  const cssFiles = [
    'app/components/workbench/theme/theme.module.css',
    'app/components/workbench/ui/controls.module.css',
    'app/components/workbench/ui/dialog.module.css',
    'app/w/[token]/features/dictation/grading.module.css',
    'app/w/[token]/features/account/AccountCenter.module.css',
    'app/admin/features/admin/AdminConsole.module.css',
  ];
  const used = new Set(cssFiles.flatMap(path => [...read(path).matchAll(/var\((--wb-[a-z0-9-]+)/g)].map(match => match[1])));
  assert.deepEqual([...used].filter(name => !produced.has(name) && !aliases.has(name)), []);
  const campusVars = runtime.themeCssVariables(runtime.campusTheme);
  const glassVars = runtime.themeCssVariables(runtime.glassTheme);
  assert.notEqual(campusVars['--wb-canvas'], glassVars['--wb-canvas']);
  assert.notEqual(campusVars['--wb-primary'], glassVars['--wb-primary']);
  assert.equal(campusVars['--wb-material-blur-ready'], '0px');
  assert.equal(glassVars['--wb-material-blur-ready'], '0px');
});

test('校园语义插画manifest使用存在的本地资源并声明无主题回退', () => {
  const assets = Object.values(runtime.campusTheme.artworkByRole);
  assert.ok(assets.length >= 17);
  for (const asset of assets) {
    assert.equal(asset.fallback, 'none');
    assert.equal(asset.decorative, true);
    assert.ok(asset.width > 0 && asset.height > 0);
    assert.ok(existsSync(fileURLToPath(new URL(`../public${asset.src}`, import.meta.url))), asset.src);
  }
  const legacyTheme = read('app/components/campus/theme.ts');
  const roles = [...legacyTheme.matchAll(/:\s*'([a-z-]+\.[a-z-]+)'/g)].map(match => match[1]);
  assert.equal(roles.length, 15);
  for (const role of roles) assert.ok(runtime.campusTheme.artworkByRole[role], role);
});

test('首批校园场景为桌面和手机提供独立候选资源', () => {
  const roles = ['home.scene', 'dictation.context', 'student.detail', 'homework.context'];
  for (const role of roles) {
    const asset = runtime.campusTheme.artworkByRole[role];
    assert.equal(asset.status, 'candidate');
    assert.equal(asset.width, 1200);
    assert.equal(asset.height, 800);
    assert.equal(asset.fit, 'cover');
    assert.equal(asset.safeTextArea, 'left');
    assert.ok(asset.mobileSrc, `${role} missing mobileSrc`);
    assert.notEqual(asset.mobileSrc, asset.src);
    assert.ok(existsSync(fileURLToPath(new URL(`../public${asset.mobileSrc}`, import.meta.url))), asset.mobileSrc);
  }
});

test('主题更新不使用React key重挂载，缺图直接为空', () => {
  const boundary = read('app/components/workbench/theme/ThemeBoundary.tsx');
  const artwork = read('app/components/workbench/theme/Artwork.tsx');
  assert.doesNotMatch(boundary, /key=|key\s*:/);
  assert.match(boundary, /style=\{themeCssVariables\(definition\)\}/);
  assert.match(boundary, /data-theme-status=\{definition\.status\}/);
  assert.match(artwork, /if \(!asset\) return null/);
  assert.doesNotMatch(artwork, /campusTheme|\?\?\s*campus|\|\|\s*campus/);
});

test('公开与内部预留主题都使用实色材质且应用样式不启用模糊', () => {
  assert.equal(runtime.campusTheme.capabilities.blur, false);
  assert.equal(runtime.glassTheme.capabilities.blur, false);
  assert.equal(runtime.campusTheme.surfaces.work.blur, '0px');
  assert.equal(runtime.glassTheme.surfaces.work.blur, '0px');
  const materialStyles = [
    read('app/components/workbench/theme/theme.module.css'),
    read('app/components/workbench/shell/shell.module.css'),
    read('app/components/workbench/ui/controls.module.css'),
    read('app/components/workbench/ui/dialog.module.css'),
    read('app/w/[token]/ClassroomPages.module.css'),
  ].join('\n');
  assert.doesNotMatch(materialStyles, /backdrop-filter|filter:\s*blur/i);
});
