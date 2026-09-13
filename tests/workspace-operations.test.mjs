import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/w/[token]/workspace/operations.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { createWorkspaceOperations } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const ok = revision => ({ ok: true, status: 200, json: async () => ({ revision }) });
function harness(t, options = {}) {
  const stored = new Map(), requests = [];
  const storage = { setItem: (k, v) => stored.set(k, v), getItem: k => stored.get(k) ?? null, removeItem: k => stored.delete(k) };
  const oldWindow = globalThis.window, oldStorage = globalThis.localStorage;
  globalThis.window = { localStorage: storage }; globalThis.localStorage = storage;
  t.after(() => { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; });
  t.mock.method(globalThis, 'fetch', async (_url, init) => { requests.push(JSON.parse(init.body)); return ok(requests.length + 1); });
  const initial = { revision: 1, data: { students: [], marker: 'original', dictation: { tasks: [] } } };
  const state = { workspace: initial, dirty: false, saving: false, error: '', conflict: false, notices: [] };
  const ref = current => ({ current });
  const b = { token: 'synthetic-only', isDemo: false, isReadOnly: false,
    workspaceRef: ref(initial), revisionRef: ref(0), serverRevisionRef: ref(1), dirtyRef: ref(false),
    saveInFlightRef: ref(null), pendingDictationDraftRef: ref(null), saveQueuedRef: ref(false), saveConflictRef: ref(false),
    setWorkspace: next => { state.workspace = typeof next === 'function' ? next(state.workspace) : next; },
    setDirty: v => { state.dirty = v; }, setSaving: v => { state.saving = v; }, setError: v => { state.error = v; }, setSaveConflict: v => { state.conflict = v; },
    notify: (...args) => state.notices.push(args), normalizeData: d => d, scopeClassSettings: (_old, d) => d, ...options };
  return { ...createWorkspaceOperations(b), b, state, stored, requests, storage };
}

test('一般本地编辑先保留草稿，服务器确认后才清dirty', async t => {
  const h = harness(t); h.updateData(d => ({ ...d, marker: 'edited' }));
  assert.equal(h.requests.length, 0); assert.equal(h.b.dirtyRef.current, true); assert.equal(h.stored.size, 1);
  assert.equal(await h.save(), true);
  assert.equal(h.requests[0].revision, 1); assert.equal(h.b.serverRevisionRef.current, 2);
  assert.equal(h.b.dirtyRef.current, false); assert.equal(h.stored.size, 0);
});
test('网络失败保留草稿及dirty，重试使用同一服务器版本', async t => {
  const h = harness(t); h.updateData(d => ({ ...d, marker: 'edited' }));
  globalThis.fetch.mock.mockImplementationOnce(async () => { throw new Error('offline'); });
  assert.equal(await h.save(), false); assert.equal(h.b.dirtyRef.current, true); assert.equal(h.stored.size, 1);
  assert.equal(await h.save(), true); assert.equal(h.requests[0].revision, 1);
});
test('本机草稿存储不可用时仍保留内存修改和dirty并明确报错', t => {
  const h = harness(t);
  h.storage.setItem = () => { throw new Error('storage unavailable'); };
  h.updateData(d => ({ ...d, marker: 'memory only' }));
  assert.equal(h.b.workspaceRef.current.data.marker, 'memory only');
  assert.equal(h.b.dirtyRef.current, true);
  assert.deepEqual(h.state.notices.at(-1), ['本机草稿存储不可用，请保持页面打开并完成服务器保存', 'error']);
});
test('409锁住后续保存，不清空本机修改', async t => {
  const h = harness(t); h.updateData(d => ({ ...d, marker: 'edited' }));
  globalThis.fetch.mock.mockImplementationOnce(async () => ({ ok: false, status: 409, json: async () => ({ code: 'WORKSPACE_CONFLICT', error: 'conflict' }) }));
  assert.equal(await h.save(), false); assert.equal(h.state.conflict, true);
  const count = globalThis.fetch.mock.callCount();
  assert.equal(await h.save(), false); assert.equal(globalThis.fetch.mock.callCount(), count); assert.equal(h.stored.size, 1);
});
test('保存期间新编辑不被旧响应清除，排队保存使用新revision', async t => {
  const h = harness(t); let release;
  globalThis.fetch.mock.mockImplementationOnce(async () => new Promise(resolve => { release = resolve; }));
  h.updateData(d => ({ ...d, marker: 'first' })); const first = h.save();
  h.updateData(d => ({ ...d, marker: 'second' })); const queued = h.save();
  release(ok(2)); assert.equal(await first, true); assert.equal(await queued, true);
  assert.equal(h.requests.at(-1).data.marker, 'second'); assert.equal(h.requests.at(-1).revision, 2); assert.equal(h.b.dirtyRef.current, false);
});
test('只读与演示不能调用听写提交；只读本地编辑也被阻止', async t => {
  const h = harness(t, { isReadOnly: true }); h.updateData(d => ({ ...d, marker: 'forbidden' }));
  assert.equal(h.b.workspaceRef.current.data.marker, 'original'); assert.equal(await h.save(), true);
  assert.equal(await h.commitWorkspace(d => d), false); assert.equal(globalThis.fetch.mock.callCount(), 0);
  const demo = createWorkspaceOperations({ ...h.b, isReadOnly: false, isDemo: true });
  demo.updateData(d => ({ ...d, marker: 'demo-forbidden' }));
  assert.equal(h.b.workspaceRef.current.data.marker, 'original');
  assert.deepEqual(h.state.notices.at(-1), ['当前为只读演示，数据不会被修改', 'info']);
  assert.equal(await demo.commitWorkspace(d => d), false); assert.equal(globalThis.fetch.mock.callCount(), 0);
});
test('听写失败不计入正式结果，保留待提交草稿', async t => {
  const h = harness(t);
  globalThis.fetch.mock.mockImplementationOnce(async () => ({ ok: false, status: 500, json: async () => ({ error: 'failed' }) }));
  assert.equal(await h.commitWorkspace(d => ({ ...d, dictation: { tasks: ['new'] } })), false);
  assert.deepEqual(h.b.workspaceRef.current.data.dictation.tasks, []);
  assert.deepEqual(h.b.pendingDictationDraftRef.current.dictation.tasks, ['new']); assert.equal(h.stored.size, 1);
});
test('听写409保留当前草稿并锁住冲突状态', async t => {
  const h = harness(t);
  globalThis.fetch.mock.mockImplementationOnce(async () => ({ ok: false, status: 409, json: async () => ({ code: 'WORKSPACE_CONFLICT', error: '另一设备已更新' }) }));
  assert.equal(await h.commitWorkspace(d => ({ ...d, dictation: { tasks: ['pending-conflict'] } })), false);
  assert.equal(h.state.conflict, true);
  assert.deepEqual(h.b.pendingDictationDraftRef.current.dictation.tasks, ['pending-conflict']);
  assert.equal(h.stored.size, 1);
  assert.match(h.state.error, /尚未计入结果/);
});
test('未计入正式结果的听写草稿阻止离开且不会误发第二次保存', async t => {
  const h = harness(t);
  globalThis.fetch.mock.mockImplementationOnce(async () => ({ ok: false, status: 500, json: async () => ({ error: 'failed' }) }));
  assert.equal(await h.commitWorkspace(d => ({ ...d, dictation: { tasks: ['pending-leave'] } })), false);
  const count = globalThis.fetch.mock.callCount();
  assert.equal(await h.ensureSavedBeforeLeave(), false);
  assert.equal(globalThis.fetch.mock.callCount(), count);
  assert.match(h.state.error, /重试保存/);
});
test('听写提交中一般新编辑被保留，成功只合并听写并保留dirty', async t => {
  const h = harness(t); let release;
  globalThis.fetch.mock.mockImplementationOnce(async () => new Promise(resolve => { release = resolve; }));
  const pending = h.commitWorkspace(d => ({ ...d, dictation: { tasks: ['accepted'] } }));
  await Promise.resolve();
  h.updateData(d => ({ ...d, marker: 'new local edit' })); release(ok(2));
  assert.equal(await pending, true); assert.equal(h.b.workspaceRef.current.data.marker, 'new local edit');
  assert.deepEqual(h.b.workspaceRef.current.data.dictation.tasks, ['accepted']); assert.equal(h.b.dirtyRef.current, true);
  assert.equal(h.b.pendingDictationDraftRef.current, null);
  const draft = JSON.parse(h.stored.get('classroom-workspace-draft:synthetic-only'));
  assert.equal(draft.revision, 2);
  assert.equal(draft.data.marker, 'new local edit');
  assert.deepEqual(draft.data.dictation.tasks, ['accepted']);
});
test('容量预检阻止超限听写请求且不改变正式结果', async t => {
  const h = harness(t);
  await assert.rejects(h.commitWorkspace(d => ({ ...d, marker: 'x'.repeat(5 * 1024 * 1024) })), /5MB/);
  assert.equal(globalThis.fetch.mock.callCount(), 0); assert.equal(h.b.workspaceRef.current.data.marker, 'original');
});
