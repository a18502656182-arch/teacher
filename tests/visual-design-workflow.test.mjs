import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { auditDesignWorkflow } from '../scripts/visual-design-workflow.mjs';
import { isPageProductFile, isSharedProductFile } from '../scripts/visual-baseline-audit.mjs';

const sha = value => createHash('sha256').update(value).digest('hex').toUpperCase();
const commit = 'a'.repeat(40);
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'staged-design-test-'));
  const records = {}, changed = [];
  const ledger = { pages: {}, gates: [{ id: 'V1', pages: ['dashboard'], status: 'user-approved', userApproval: { approved: true } }, { id: 'V2', pages: ['students', 'homework', 'dictation'] }], sharedRegressionTriggers: ['app/components/workbench'] };
  const write = (name, value) => { const file = path.join(root, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, value); return name; };
  const evidence = (id, kind, type) => {
    const bytes = `${id}-${kind}-${type}`;
    return { path: write(`${id}/${type}-${kind}.png`, bytes), sha256: sha(bytes), kind, viewport: kind === 'desktop' ? '1536x1024' : '390x844', commit, stateId: 'normal', fixtureId: 'synthetic', fixtureSha256: sha('fixture'), capturedAt: '2026-09-14T10:00:00Z', browser: 'test-browser', font: 'test-font', dpr: 1, url: 'http://127.0.0.1:4207/' };
  };
  for (const id of ledger.gates[1].pages) {
    const record = { pageId: id, batch: 'V2', phase: 'design-approved', conceptApproval: { approved: true, source: 'synthetic test approval', approvedAt: '2026-09-14' }, prototype: { commit, sourceFiles: [`tools/designs/${id}.tsx`], evidence: ['desktop', 'mobile'].map(kind => evidence(id, kind, 'design')) }, integration: { productCommit: commit, designCommit: commit, evidence: ['desktop', 'mobile'].map(kind => evidence(id, kind, 'result')), tests: [{ path: write(`${id}/test.txt`, 'test fixture'), sha256: sha('test fixture'), exitCode: 0, commit }] }, issues: [] };
    for (const key of ['brief', 'functionMap', 'geometry', 'assets', 'states']) record[key] = write(`${id}/${key}.json`, '{}');
    record.designApproval = { approved: true, source: 'synthetic test approval', approvedAt: '2026-09-14', commit, evidenceHashes: record.prototype.evidence.map(e => e.sha256) };
    record.resultApproval = { approved: true, source: 'synthetic test approval', approvedAt: '2026-09-14', productCommit: commit, designCommit: commit };
    records[id] = record;
    ledger.pages[id] = { recordPath: `${id}/record.json` };
  }
  const sync = () => { for (const [id, r] of Object.entries(records)) { const bytes = JSON.stringify(r); write(ledger.pages[id].recordPath, bytes); ledger.pages[id].recordSha256 = sha(bytes); } };
  const run = (stage = 'integration') => { sync(); return auditDesignWorkflow(root, ledger, ['--gate', 'V2', '--stage', stage], { gitCommitExists: (_, c) => c === commit, changedTrackedFiles: () => changed, isPageProductFile, isSharedProductFile }); };
  return { root, records, changed, ledger, run };
}
test('all three D approvals allow integration without any supervision report', () => { assert.deepEqual(fixture().run().failures, []); });
test('homepage approval cannot unlock V2; concept confirmation cannot replace runnable D approval', () => {
  const f = fixture();
  for (const r of Object.values(f.records)) { r.phase = 'concept-review'; r.prototype = { commit: null, evidence: [] }; r.designApproval.approved = false; r.resultApproval.approved = false; }
  const errors = f.run().failures;
  assert.ok(errors.some(e => e.includes('runnable design commit missing')));
  assert.ok(errors.some(e => e.includes('human D')));
});
test('two of three D approvals do not permit any page to integrate', () => {
  const f = fixture(); f.records.dictation.designApproval.approved = false; f.records.dictation.resultApproval.approved = false;
  f.records.students.phase = 'integrating';
  assert.ok(f.run().failures.some(e => e.includes('dictation: awaiting human D')));
});
test('modified screenshot bytes invalidate a previously approved design hash', () => {
  const f = fixture(); writeFileSync(path.join(f.root, f.records.students.prototype.evidence[0].path), 'changed');
  assert.ok(f.run().failures.some(e => e.includes('stale/missing design hash')));
});
test('design approval must bind the exact complete set of screenshot hashes', () => {
  const f = fixture(); f.records.students.designApproval.evidenceHashes.pop();
  assert.ok(f.run().failures.some(e => e.includes('D approval evidence hashes mismatch')));
});
test('product changes invalidate R, including uncommitted changes and shared assets', () => {
  for (const file of ['app/w/[token]/features/students/StudentsView.tsx', 'public/art/scene.webp']) {
    const f = fixture(); f.changed.push(file);
    assert.ok(f.run('next-batch').failures.some(e => e.includes('product changed after result evidence')));
  }
});
test('page record hash drift and unsafe paths fail closed', () => {
  const f = fixture(); f.run();
  const file = path.join(f.root, f.ledger.pages.students.recordPath); writeFileSync(file, `${readFileSync(file)} `);
  const check = () => auditDesignWorkflow(f.root, f.ledger, [], { gitCommitExists: () => true, changedTrackedFiles: () => [], isPageProductFile, isSharedProductFile });
  assert.ok(check().failures.some(e => e.includes('page record hash changed')));
  f.ledger.pages.students.recordPath = '../outside.json';
  assert.ok(check().failures.some(e => e.includes('unsafe page record')));
});
test('no generic gate command or result approval for another design can pass', () => {
  const f = fixture(); f.records.students.resultApproval.designCommit = 'b'.repeat(40);
  assert.ok(f.run('next-batch').failures.some(e => e.includes('human R')));
  assert.ok(f.run('unknown').failures.some(e => e.includes('specify --stage')));
});
