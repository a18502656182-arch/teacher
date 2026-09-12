import type { Dispatch, SetStateAction } from 'react';
import type { ClassroomData } from '@/lib/classroom';
import type { LocalWorkspaceDraft, Workspace } from './types';
type Ref<T> = { current: T };
export interface WorkspaceOperationBindings {
 token: string; isDemo: boolean; isReadOnly: boolean;
 workspaceRef: Ref<Workspace | null>; revisionRef: Ref<number>; serverRevisionRef: Ref<number>;
 dirtyRef: Ref<boolean>; saveInFlightRef: Ref<Promise<boolean> | null>;
 pendingDictationDraftRef: Ref<ClassroomData | null>; saveQueuedRef: Ref<boolean>; saveConflictRef: Ref<boolean>;
 setWorkspace: Dispatch<SetStateAction<Workspace | null>>;
 setDirty: (value: boolean) => void; setSaving: (value: boolean) => void;
 setError: (value: string) => void; setSaveConflict: (value: boolean) => void;
 notify: (message: string, tone: 'info' | 'error' | 'success') => void;
 normalizeData: (data: ClassroomData) => ClassroomData;
 scopeClassSettings: (previous: ClassroomData, updated: ClassroomData) => ClassroomData;
}
/** Retains the incumbent closures and refs. No state is owned by this factory.
 * updateData is a local edit; save flushes it; commitWorkspace is dictation-specific.
 */
export function createWorkspaceOperations(bindings: WorkspaceOperationBindings) {
 const { token, isDemo, isReadOnly, workspaceRef, revisionRef, serverRevisionRef, dirtyRef,
 saveInFlightRef, pendingDictationDraftRef, saveQueuedRef, saveConflictRef,
 setWorkspace, setDirty, setSaving, setError, setSaveConflict, notify, normalizeData, scopeClassSettings } = bindings;
  function updateData(updater: (current: ClassroomData) => ClassroomData) {
    if (isReadOnly) {
      notify("当前处于到期宽限期，只能查看和导出", "info");
      return;
    }
    const current = workspaceRef.current;
    if (!current) return;
    const updated = updater(current.data);
    const next = { ...current, data: normalizeData(scopeClassSettings(current.data, updated)) };
    workspaceRef.current = next;
    setWorkspace(next);
    if (!isDemo) {
      try {
        const draft: LocalWorkspaceDraft = { revision: serverRevisionRef.current, data: next.data, savedAt: Date.now() };
        window.localStorage.setItem(`classroom-workspace-draft:${token}`, JSON.stringify(draft));
      } catch { notify('本机草稿存储不可用，请保持页面打开并完成服务器保存', 'error'); }
    }
    if (!isDemo) {
      revisionRef.current += 1;
      dirtyRef.current = true;
      setDirty(true);
    }
  }

  async function save(): Promise<boolean> {
    if (saveConflictRef.current) {
      setError("另一台设备已有更新。当前修改已保存在本机，请刷新并核对最新数据后继续。");
      return false;
    }
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      const ok = await saveInFlightRef.current;
      if (!ok) return false;
      return dirtyRef.current ? save() : true;
    }
    const target = workspaceRef.current;
    if (!target || !dirtyRef.current || isDemo || isReadOnly) return true;
    const localRevision = revisionRef.current;
    const expectedServerRevision = serverRevisionRef.current;
    const request = (async () => {
      setSaving(true);
      setError("");
      try {
        const res = await fetch(`/api/workspace/${token}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: target.data, revision: expectedServerRevision }) });
        const body = await res.json().catch(() => ({})) as { error?: string; code?: string; revision?: number };
        if (!res.ok) {
          if (res.status === 409 && body.code === "WORKSPACE_CONFLICT") {
            saveConflictRef.current = true;
            setSaveConflict(true);
          }
          throw new Error(body.error || "保存失败");
        }
        serverRevisionRef.current = Number(body.revision ?? expectedServerRevision + 1);
        setWorkspace((current) => current ? { ...current, revision: serverRevisionRef.current } : current);
        if (localRevision === revisionRef.current) {
          dirtyRef.current = false;
          setDirty(false);
          try { window.localStorage.removeItem(`classroom-workspace-draft:${token}`); } catch { /* Server acknowledgement is authoritative. */ }
        } else {
          const latest = workspaceRef.current;
          if (latest) {
            const draft: LocalWorkspaceDraft = { revision: serverRevisionRef.current, data: latest.data, savedAt: Date.now() };
            try { window.localStorage.setItem(`classroom-workspace-draft:${token}`, JSON.stringify(draft)); } catch { /* Keep in-memory draft. */ }
          }
        }
        return true;
      } catch (saveError) {
        const message = saveError instanceof Error ? saveError.message : "暂时无法保存";
        setError(saveConflictRef.current ? `${message}。本机修改已保留，请刷新后核对。` : `${message}，修改已保存在本机，可点击重试`);
        return false;
      } finally {
        setSaving(false);
      }
    })();
    saveInFlightRef.current = request;
    const result = await request;
    saveInFlightRef.current = null;
    if (saveQueuedRef.current && dirtyRef.current && !saveConflictRef.current) {
      saveQueuedRef.current = false;
      return save();
    }
    saveQueuedRef.current = false;
    return result;
  }

  async function commitWorkspace(updater: (data: ClassroomData) => ClassroomData) {
    if (isDemo || isReadOnly || saveConflictRef.current) return false;
    if (!await save()) return false;
    const current = workspaceRef.current;
    if (!current) return false;
    const next = updater(current.data);
    if (new Blob([JSON.stringify(next)]).size > 4.8 * 1024 * 1024) throw new Error("工作区接近5MB上限，请先导出完整备份并整理历史，再继续保存。");
    const expectedRevision = serverRevisionRef.current;
    pendingDictationDraftRef.current = next;
    const localRevision = revisionRef.current;
    try { localStorage.setItem(`classroom-workspace-draft:${token}`, JSON.stringify({ revision: expectedRevision, data: next, savedAt: Date.now() })); } catch { /* The editor keeps its draft in memory. */ }
    const request = (async () => {
      setSaving(true);
      try {
        const response = await fetch(`/api/workspace/${token}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: next, revision: expectedRevision }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 409) { saveConflictRef.current = true; setSaveConflict(true); }
          throw new Error(body.error || "听写保存失败");
        }
        serverRevisionRef.current = Number(body.revision);
        const latest = workspaceRef.current ?? current;
        const accepted = { ...latest, revision: serverRevisionRef.current, data: localRevision === revisionRef.current ? next : { ...latest.data, dictation: next.dictation } };
        workspaceRef.current = accepted;
        pendingDictationDraftRef.current = null;
        setWorkspace(accepted);
        setError("");
        try {
          if (localRevision === revisionRef.current) localStorage.removeItem(`classroom-workspace-draft:${token}`);
          else localStorage.setItem(`classroom-workspace-draft:${token}`, JSON.stringify({
            revision: serverRevisionRef.current, data: accepted.data, savedAt: Date.now(),
          } satisfies LocalWorkspaceDraft));
        } catch { /* Keep the unsaved edit in memory if local storage is unavailable. */ }
        return true;
      } catch (error) {
        setError(`${error instanceof Error ? error.message : "听写保存失败"}。听写尚未计入结果，本机草稿已保留。${saveConflictRef.current ? "" : "请在听写页面重试保存"}`);
        return false;
      } finally { setSaving(false); }
    })();
    saveInFlightRef.current = request;
    try { return await request; } finally { if (saveInFlightRef.current === request) saveInFlightRef.current = null; }
  }

  return { updateData, save, commitWorkspace };
}
