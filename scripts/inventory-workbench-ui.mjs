/** Read-only source inventory. Output is review input, never proof of functional coverage. */
import ts from 'typescript';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const roots = ['app/w', 'app/components/campus', 'app/admin', 'app/privacy'];
const files = ['app/page.tsx'];
async function walk(directory) {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await walk(file);
    else if (file.endsWith('.tsx')) files.push(file);
  }
}
for (const directory of roots) await walk(directory);
const rows = [];
for (const file of files.sort()) {
  const source = await readFile(path.join(root, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node, owner = '(module)') {
    if (ts.isFunctionDeclaration(node) && node.name) owner = node.name.text;
    if (ts.isVariableDeclaration(node) && node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) owner = node.name.getText(ast);
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      const attribute = name => attributes.find(a => a.name.getText(ast) === name)?.initializer?.getText(ast) ?? '';
      const events = attributes.filter(a => /^on[A-Z]/.test(a.name.getText(ast)));
      const overlay = /dialog|modal|drawer/i.test(`${tag} ${attribute('role')} ${attribute('className')}`);
      if (events.length || overlay) {
        const text = ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent)
          ? node.parent.children.filter(ts.isJsxText).map(n => n.text.trim()).filter(Boolean).join(' ') : '';
        rows.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, owner, tag,
          label: attribute('aria-label') || text || attribute('title'),
          events: Object.fromEntries(events.map(a => [a.name.getText(ast), a.initializer?.getText(ast) ?? ''])),
          overlay, review: 'needs-handler-and-render-review' });
      }
    }
    ts.forEachChild(node, child => visit(child, owner));
  }
  visit(ast);
}
console.log(JSON.stringify({ sourceFiles: files.length, interactions: rows.length,
  overlayCandidates: rows.filter(row => row.overlay).length,
  limitation: 'AST candidates include repeated render expressions; excludes dynamically dispatched controls. Review handlers, callees and both rendered views before declaring coverage.', rows }, null, 2));
