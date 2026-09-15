import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const phases = new Set(['not-started', 'inventory', 'concept-review', 'prototype', 'awaiting-design-approval', 'design-approved', 'integrating', 'awaiting-result-approval', 'result-approved', 'needs-design-changes', 'needs-integration-fix', 'needs-regression-review']);
const hash = value => createHash('sha256').update(value).digest('hex').toUpperCase();
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toUpperCase() === b.toUpperCase();
function argument(argv, key) { const i = argv.indexOf(key); return argv.find(v => v.startsWith(`${key}=`))?.slice(key.length + 1) ?? (i >= 0 ? argv[i + 1] : undefined); }
function fileWithin(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative) || relative.replaceAll('\\', '/').split('/').includes('..')) return null;
  const file = path.resolve(root, relative);
  if (!existsSync(file)) return null;
  const rel = path.relative(realpathSync(root), realpathSync(file));
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? file : null;
}

// Schema 3 retains schema-2 product evidence/history. Linked records alone own D/R approvals.
export function auditDesignWorkflow(root, ledger, argv, git) {
  const failures = [], gates = [], records = new Map();
  for (const [id, page] of Object.entries(ledger.pages)) {
    if (!page.recordPath) continue;
    const file = fileWithin(root, page.recordPath);
    if (!file) { failures.push(`${id}: missing or unsafe page record.`); continue; }
    if (!same(hash(readFileSync(file)), page.recordSha256)) failures.push(`${id}: page record hash changed.`);
    try {
      const record = JSON.parse(readFileSync(file, 'utf8'));
      if (record.pageId !== id || !phases.has(record.phase) || record.template) failures.push(`${id}: invalid page identity/phase/template.`);
      if (!ledger.gates.some(g => g.id === record.batch && g.pages.includes(id))) failures.push(`${id}: record batch mismatch.`);
      records.set(id, record);
    } catch { failures.push(`${id}: invalid record JSON.`); }
  }

  function artifacts(id, list, label, commit) {
    const errors = [], kinds = new Set(), paths = new Set();
    if (!Array.isArray(list) || !list.length) return [`${id}: ${label} evidence missing.`];
    for (const e of list) {
      const file = fileWithin(root, e.path);
      if (!file || !same(hash(readFileSync(file)), e.sha256)) errors.push(`${id}: stale/missing ${label} hash.`);
      if (file && paths.has(file)) errors.push(`${id}: duplicate ${label} evidence.`);
      if (file) paths.add(file);
      if (e.commit !== commit || e.kind === 'candidate') errors.push(`${id}: ${label} is not bound to runnable source commit.`);
      if (!e.stateId || !e.fixtureId || !e.fixtureSha256 || !e.capturedAt || !e.browser || !e.font || !e.dpr || !e.url) errors.push(`${id}: ${label} environment metadata missing.`);
      if (e.kind === 'desktop' && e.viewport === '1536x1024') kinds.add('desktop');
      if (e.kind === 'mobile' && e.viewport === '390x844') kinds.add('mobile');
    }
    for (const kind of ['desktop', 'mobile']) if (!kinds.has(kind)) errors.push(`${id}: ${label} needs ${kind} evidence.`);
    return errors;
  }

  function designReady(id, r) {
    if (!r) return [`${id}: inventory not started.`];
    const errors = [];
    if (!r.conceptApproval?.approved || !r.conceptApproval.source || !r.conceptApproval.approvedAt) errors.push(`${id}: candidate direction awaits user confirmation.`);
    const p = r.prototype;
    if (!p?.commit || !git.gitCommitExists(root, p.commit)) errors.push(`${id}: runnable design commit missing.`);
    errors.push(...artifacts(id, p?.evidence, 'design', p?.commit));
    if (!p?.sourceFiles?.length) errors.push(`${id}: frozen design source files missing.`);
    else if (p.commit && git.changedTrackedFiles(root, p.commit).some(f => p.sourceFiles.includes(f) || git.isSharedProductFile(f, ledger))) errors.push(`${id}: design source changed after frozen commit.`);
    for (const key of ['brief', 'functionMap', 'geometry', 'assets', 'states']) if (!fileWithin(root, r[key])) errors.push(`${id}: ${key} contract missing.`);
    if (r.issues?.some(i => typeof i === 'object' && i.blocking && !i.resolved)) errors.push(`${id}: unresolved blocking design issues.`);
    return errors;
  }
  function designApproved(id, r) {
    const errors = designReady(id, r), a = r?.designApproval;
    if (!a?.approved || !a.source || !a.approvedAt || a.commit !== r?.prototype?.commit) errors.push(`${id}: awaiting human D design approval.`);
    const expected = (r?.prototype?.evidence ?? []).map(e => e.sha256?.toUpperCase()).sort();
    const approved = (a?.evidenceHashes ?? []).map(v => v.toUpperCase()).sort();
    if (!expected.length || JSON.stringify(expected) !== JSON.stringify(approved)) errors.push(`${id}: D approval evidence hashes mismatch.`);
    return errors;
  }
  function overlayApproved(id, r) {
    const a = r?.overlayReview;
    if (!a?.requiredBeforeIntegration) return [];
    if (!a.approved || !a.source || !a.approvedAt || a.commit !== r?.prototype?.commit) return [`${id}: deferred overlays and uncovered states await supplemental human approval before integration.`];
    return [];
  }
  function resultReady(id, r) {
    const errors = [...designApproved(id, r), ...overlayApproved(id, r)], i = r?.integration;
    if (!i?.productCommit || !git.gitCommitExists(root, i.productCommit) || i.designCommit !== r?.prototype?.commit) errors.push(`${id}: integration version binding missing.`);
    errors.push(...artifacts(id, i?.evidence, 'result', i?.productCommit));
    if (!i?.tests?.length || i.tests.some(t => t.exitCode !== 0 || t.commit !== i.productCommit || !fileWithin(root, t.path) || !same(hash(readFileSync(fileWithin(root, t.path))), t.sha256))) errors.push(`${id}: current product test logs missing/stale/failed.`);
    if (i?.productCommit && git.changedTrackedFiles(root, i.productCommit).some(f => git.isSharedProductFile(f, ledger) || git.isPageProductFile(id, f))) errors.push(`${id}: product changed after result evidence.`);
    return errors;
  }
  function resultApproved(id, r) {
    const errors = resultReady(id, r), a = r?.resultApproval;
    if (!a?.approved || !a.source || !a.approvedAt || a.productCommit !== r?.integration?.productCommit || a.designCommit !== r?.prototype?.commit) errors.push(`${id}: awaiting human R result approval.`);
    return errors;
  }
  for (const [id, r] of records) {
    if (r.designApproval?.approved) failures.push(...designApproved(id, r));
    if (r.resultApproval?.approved) failures.push(...resultApproved(id, r));
  }
  let priorApproved = true;
  for (const gate of ledger.gates) {
    const legacy = gate.id === 'V1' && gate.userApproval?.approved && gate.status === 'user-approved';
    const designErrors = legacy ? [] : gate.pages.flatMap(id => designReady(id, records.get(id)));
    const integrationErrors = legacy ? [] : gate.pages.flatMap(id => [...designApproved(id, records.get(id)), ...overlayApproved(id, records.get(id))]);
    const resultErrors = legacy ? [] : gate.pages.flatMap(id => resultReady(id, records.get(id)));
    const nextErrors = legacy ? [] : gate.pages.flatMap(id => resultApproved(id, records.get(id)));
    const blocked = priorApproved ? [] : [`${gate.id}: previous batch R approval required.`];
    const status = legacy ? 'historical-result-approved' : blocked.length ? 'blocked-by-previous-batch' : !nextErrors.length ? 'allow-next-batch' : !resultErrors.length ? 'awaiting-result-approval' : !integrationErrors.length ? 'allow-integration' : !designErrors.length ? 'awaiting-design-approval' : 'design-in-progress';
    gates.push({ gate: gate.id, status, pages: gate.pages.map(id => ({ id, phase: records.get(id)?.phase ?? (legacy ? 'historical-approved' : 'not-started') })) });
    for (const id of gate.pages) {
      if (['integrating', 'awaiting-result-approval', 'result-approved'].includes(records.get(id)?.phase)) failures.push(...blocked, ...integrationErrors);
    }
    if (argument(argv, '--gate')?.toUpperCase() === gate.id) {
      const stage = argument(argv, '--stage');
      const stages = { 'design-review': designErrors, integration: integrationErrors, 'result-review': resultErrors, 'next-batch': nextErrors };
      if (!stage || !Object.hasOwn(stages, stage)) failures.push(`${gate.id}: specify --stage design-review|integration|result-review|next-batch; a generic gate is not approval.`);
      else failures.push(...blocked, ...stages[stage]);
    }
    priorApproved &&= !nextErrors.length;
  }
  if (argument(argv, '--gate') && !ledger.gates.some(g => g.id === argument(argv, '--gate').toUpperCase())) failures.push('Unknown staged gate.');
  return { failures: [...new Set(failures)], gates };
}
