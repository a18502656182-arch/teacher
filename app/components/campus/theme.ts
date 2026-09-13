import { resolvePublicTheme, type ArtworkRole, type ThemeId } from '../workbench/theme/contracts';

/** Compatibility names for pages that have not yet migrated to semantic artwork roles. */
export type ArtworkSlot = 'dashboard' | 'entry' | 'dictation' | 'family' | 'roster' | 'homework' | 'assessment' | 'planning' | 'duty' | 'cadres' | 'care' | 'communication' | 'tools' | 'admin' | 'empty';
export type ThemeName = ThemeId;

export const artworkRoleBySlot: Record<ArtworkSlot, ArtworkRole> = {
  dashboard: 'home.scene',
  entry: 'entry.scene',
  dictation: 'dictation.context',
  family: 'family.context',
  roster: 'student.detail',
  homework: 'homework.context',
  assessment: 'assessment.context',
  planning: 'planning.context',
  duty: 'duty.context',
  cadres: 'organization.context',
  care: 'care.context',
  communication: 'communication.context',
  tools: 'tools.context',
  admin: 'admin.context',
  empty: 'empty.no-results',
};

export function resolveTheme(): ThemeName { return resolvePublicTheme(); }
