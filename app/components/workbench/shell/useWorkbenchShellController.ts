'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isWorkspaceModule, type LearningScene, type WorkspaceModuleId } from './catalog';
import { popModuleTrail, pushModuleTrail } from './history';

type OpenOptions = { guard?: boolean; replace?: boolean };

/** One navigation owner for desktop, mobile, URL history and learning scene. */
export function useWorkbenchShellController(canLeave: () => boolean) {
  const [active, setActive] = useState<WorkspaceModuleId>('dashboard');
  const [scene, setSceneState] = useState<LearningScene>('class');
  const activeRef = useRef(active);
  const trailRef = useRef<WorkspaceModuleId[]>(['dashboard']);

  useEffect(() => { activeRef.current = active; }, [active]);

  const writeUrl = useCallback((id: WorkspaceModuleId, replace = false) => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', id);
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
  }, []);

  const open = useCallback((id: WorkspaceModuleId, options: OpenOptions = {}) => {
    if (id === activeRef.current) return true;
    if (options.guard !== false && !canLeave()) return false;
    trailRef.current = pushModuleTrail(trailRef.current, id, options.replace);
    activeRef.current = id;
    setActive(id);
    writeUrl(id, options.replace);
    return true;
  }, [canLeave, writeUrl]);

  const back = useCallback(() => {
    if (!canLeave()) return false;
    const next = popModuleTrail(trailRef.current);
    trailRef.current = next.trail;
    activeRef.current = next.target;
    setActive(next.target);
    writeUrl(next.target, true);
    return true;
  }, [canLeave, writeUrl]);

  const setScene = useCallback((next: LearningScene, options: Pick<OpenOptions, 'guard'> = {}) => {
    if (next === scene) return true;
    if (options.guard !== false && !canLeave()) return false;
    setSceneState(next);
    return true;
  }, [canLeave, scene]);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('page');
    if (isWorkspaceModule(initial)) {
      trailRef.current = initial === 'dashboard' ? ['dashboard'] : ['dashboard', initial];
      activeRef.current = initial;
      setActive(initial);
    }
    const onPopState = () => {
      const requested = new URLSearchParams(window.location.search).get('page');
      const next = isWorkspaceModule(requested) ? requested : 'dashboard';
      if (next === activeRef.current) return;
      if (!canLeave()) {
        writeUrl(activeRef.current, true);
        return;
      }
      const currentTrail = trailRef.current;
      trailRef.current = currentTrail.at(-2) === next
        ? popModuleTrail(currentTrail).trail
        : pushModuleTrail(currentTrail, next);
      activeRef.current = next;
      setActive(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [canLeave, writeUrl]);

  return { active, scene, open, back, setScene };
}
