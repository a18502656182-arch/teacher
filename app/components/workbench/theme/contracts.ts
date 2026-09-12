export type ThemeId = 'campus' | 'glass';

export type ArtworkRole =
  | 'home.scene' | 'dictation.context' | 'student.detail' | 'homework.context'
  | 'assessment.context' | 'planning.context' | 'care.context'
  | 'communication.context' | 'organization.context' | 'family.context'
  | 'empty.first-use' | 'empty.no-results';

export interface ArtworkAsset {
  src: string;
  mobileSrc?: string;
  width: number;
  height: number;
  fit: 'contain' | 'cover';
  focalPoint: readonly [number, number];
  safeTextArea: 'none' | 'left' | 'right';
  decorative: true;
  status: 'candidate' | 'ready';
}

export interface ThemeDefinition {
  id: ThemeId;
  status: 'development' | 'planned' | 'ready';
  artworkByRole: Partial<Record<ArtworkRole, ArtworkAsset>>;
  capabilities: { blur: boolean; reducedMotion: boolean };
}

/** Public theme selection stays deliberately closed until glass is fully verified. */
export function resolvePublicTheme(): ThemeId { return 'campus'; }
