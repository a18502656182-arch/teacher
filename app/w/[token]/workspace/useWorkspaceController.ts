'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClassroomData } from '@/lib/classroom';
import { createWorkspaceOperations } from './operations';
import type { LocalWorkspaceDraft, Workspace } from './types';

type NoticeTone = 'info' | 'error' | 'success';
type WorkspaceUpdater = (data: ClassroomData) => ClassroomData;

export type WorkspaceControllerOptions = {
  token: string;
  notify: (message: string, tone: NoticeTone) => void;
  normalizeData: (data: ClassroomData) => ClassroomData;
  scopeClassSettings: (previous: ClassroomData, updated: ClassroomData) => ClassroomData;
};

export function useWorkspaceController({ token, notify, normalizeData, scopeClassSettings }: WorkspaceControllerOptions) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const workspaceRef = useRef<Workspace | null>(null);
  const revisionRef = useRef(0);
  const serverRevisionRef = useRef(1);
  const dirtyRef = useRef(false);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const pendingDictationDraftRef = useRef<ClassroomData | null>(null);
  const saveQueuedRef = useRef(false);
  const saveConflictRef = useRef(false);
  const isDemo = token === 'demo';
  const isReadOnly = workspace?.accessMode === 'readonly';

  useEffect(() => {
    fetch(`/api/workspace/${token}`).then(async response => {
      const body = await response.json() as { workspace?: Workspace; error?: string };
      if (response.status === 401) {
        window.location.assign('/?enter=1');
        return;
      }
      if (!response.ok || !body.workspace) throw new Error(body.error || '链接读取失败');
      const serverRevision = Number(body.workspace.revision ?? 1);
      const draftKey = `classroom-workspace-draft:${token}`;
      let recoveredDraft: LocalWorkspaceDraft | null = null;
      try {
        const stored = window.localStorage.getItem(draftKey);
        if (stored) recoveredDraft = JSON.parse(stored) as LocalWorkspaceDraft;
      } catch {
        recoveredDraft = null;
      }
      const recoveredData = recoveredDraft?.revision === serverRevision ? recoveredDraft.data : undefined;
      const canRecover = Boolean(recoveredData);
      const nextWorkspace = { ...body.workspace, revision: serverRevision, data: normalizeData(recoveredData ?? body.workspace.data) };
      serverRevisionRef.current = serverRevision;
      workspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);
      if (canRecover) {
        dirtyRef.current = true;
        revisionRef.current += 1;
        setDirty(true);
        notify('已恢复上次未成功同步的本机草稿', 'info');
      } else if (recoveredDraft?.data) {
        notify('检测到较旧的本机草稿，已保留在浏览器中，可从完整备份恢复', 'info');
      }
    }).catch(loadError => setError(loadError instanceof Error ? loadError.message : '链接读取失败')).finally(() => setLoading(false));
  }, [normalizeData, notify, token]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  function workspaceOperations() {
    return createWorkspaceOperations({
      token, isDemo, isReadOnly, workspaceRef, revisionRef, serverRevisionRef, dirtyRef,
      saveInFlightRef, pendingDictationDraftRef, saveQueuedRef, saveConflictRef,
      setWorkspace, setDirty, setSaving, setError, setSaveConflict, notify, normalizeData, scopeClassSettings,
    });
  }

  function updateData(updater: WorkspaceUpdater) {
    workspaceOperations().updateData(updater);
  }

  function save() {
    return workspaceOperations().save();
  }

  function commitWorkspace(updater: WorkspaceUpdater) {
    return workspaceOperations().commitWorkspace(updater);
  }

  async function loadLatestWorkspace() {
    try {
      const response = await fetch(`/api/workspace/${token}`, { cache: 'no-store' });
      const body = await response.json() as { workspace?: Workspace; error?: string };
      if (!response.ok || !body.workspace) throw new Error(body.error || '无法读取服务器最新版本');
      const serverRevision = Number(body.workspace.revision ?? 1);
      const latest = { ...body.workspace, revision: serverRevision, data: normalizeData(body.workspace.data) };
      serverRevisionRef.current = serverRevision;
      revisionRef.current = 0;
      saveConflictRef.current = false;
      setSaveConflict(false);
      pendingDictationDraftRef.current = null;
      dirtyRef.current = false;
      workspaceRef.current = latest;
      setWorkspace(latest);
      setDirty(false);
      setError('');
      notify('已载入服务器最新版本，本机冲突草稿仍保留在浏览器中', 'success');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '无法读取服务器最新版本');
    }
  }

  useEffect(() => {
    if (!dirty || isDemo || isReadOnly) return;
    const timer = window.setTimeout(() => { void workspaceOperations().save(); }, 900);
    return () => window.clearTimeout(timer);
    // Autosave intentionally restarts for every local data revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, workspace?.data, isDemo, isReadOnly]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function getCurrentWorkspace() {
    return workspaceRef.current;
  }

  function getBackupData() {
    return pendingDictationDraftRef.current ?? workspaceRef.current?.data ?? null;
  }

  async function ensureSavedBeforeLeave() {
    return workspaceOperations().ensureSavedBeforeLeave();
  }

  return {
    workspace,
    loading,
    error,
    dirty,
    saving,
    saveConflict,
    isDemo,
    isReadOnly,
    updateData,
    save,
    commitWorkspace,
    loadLatestWorkspace,
    ensureSavedBeforeLeave,
    getCurrentWorkspace,
    getBackupData,
    clearError: () => setError(''),
  };
}
