import type { WorkspaceModuleId } from './catalog';

export function pushModuleTrail(trail: readonly WorkspaceModuleId[], id: WorkspaceModuleId, replace = false) {
  if (trail.at(-1) === id) return [...trail];
  if (replace) return [...trail.slice(0, -1), id];
  return [...trail, id];
}

export function popModuleTrail(trail: readonly WorkspaceModuleId[]) {
  const nextTrail = trail.length > 1 ? trail.slice(0, -1) : ['dashboard' as const];
  return { trail: [...nextTrail], target: nextTrail.at(-1) ?? 'dashboard' };
}
