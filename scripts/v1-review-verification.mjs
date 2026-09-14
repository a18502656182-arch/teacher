import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const productCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve(root, process.argv[2] || '.qa-shots/v1-review-final');
mkdirSync(out, { recursive: true });
const commands = [
  ['types', 'npx tsc --noEmit --pretty false --incremental false'],
  ['lint', 'npm run lint'],
  ['tests', 'npm test'],
  ['strict', 'npm run qa:strict', { QA_REPORT_DIR: path.join(out, 'strict') }],
  ['demo', 'node scripts/layout-audit.mjs --serve', { QA_PAGES: 'dashboard', QA_VIEWPORTS: 'referenceDesktop:1536x1024,referenceMobile:390x844' }],
  ['large', 'node scripts/layout-audit.mjs --serve', { QA_PAGES: 'dashboard', QA_VIEWPORTS: 'referenceDesktop:1536x1024,referenceMobile:390x844', QA_DASHBOARD_SCENARIO: 'large', QA_DASHBOARD_DATE: '2026-11-23' }],
  ['empty', 'node scripts/layout-audit.mjs --serve', { QA_PAGES: 'dashboard', QA_VIEWPORTS: 'referenceDesktop:1536x1024,referenceMobile:390x844', QA_DASHBOARD_SCENARIO: 'empty', QA_DASHBOARD_DATE: '2026-01-05' }],
];
const manifest = { productCommit, startedAt: new Date().toISOString(), node: process.version, platform: process.platform, tests: [] };
for (const [id, command, environment = {}] of commands) {
  const dir = path.join(out, id);
  mkdirSync(dir, { recursive: true });
  const startedAt = new Date().toISOString();
  console.log(`START ${id}: ${command}`);
  const result = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'sh', process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-c', command], {
    cwd: root, encoding: 'utf8', maxBuffer: 24 * 1024 * 1024,
    env: { ...process.env, QA_REPORT_DIR: dir, ...(['demo', 'large', 'empty'].includes(id) ? { QA_SCREENSHOT_DIR: dir } : {}), ...environment },
  });
  const log = path.join(out, `${id}.txt`);
  writeFileSync(log, `productCommit: ${productCommit}\ncommand: ${command}\nstartedAt: ${startedAt}\n${result.stdout ?? ''}\n${result.stderr ?? ''}\nexitCode: ${result.status}\n`);
  manifest.tests.push({ id, command, productCommit, startedAt, endedAt: new Date().toISOString(), exitCode: result.status, log: path.relative(root, log).replaceAll('\\', '/'), sha256: createHash('sha256').update(readFileSync(log)).digest('hex') });
  writeFileSync(path.join(out, 'verification.json'), JSON.stringify(manifest, null, 2));
  console.log(`END ${id}: ${result.status}`);
  if (result.status !== 0) { console.error(result.stdout, result.stderr); process.exit(1); }
}
