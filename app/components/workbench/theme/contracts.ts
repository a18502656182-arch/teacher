export type ThemeId = 'campus' | 'glass';
export type ThemeStatus = 'development' | 'planned' | 'ready';

export type ArtworkRole =
  | 'home.scene'
  | 'entry.scene'
  | 'dictation.context'
  | 'dictation.grading'
  | 'student.detail'
  | 'homework.context'
  | 'assessment.context'
  | 'planning.context'
  | 'duty.context'
  | 'organization.context'
  | 'care.context'
  | 'communication.context'
  | 'tools.context'
  | 'family.context'
  | 'admin.context'
  | 'empty.first-use'
  | 'empty.no-results';

export interface ArtworkAsset {
  src: string;
  mobileSrc?: string;
  width: number;
  height: number;
  fit: 'contain' | 'cover';
  focalPoint: readonly [number, number];
  safeTextArea: 'none' | 'left' | 'right';
  decorative: true;
  fallback: 'none';
  status: 'candidate' | 'ready';
}

export interface ThemeSemanticColors {
  surface: {
    canvas: string;
    context: string;
    assist: string;
    attention: string;
    disabled: string;
  };
  text: { main: string; muted: string; onPrimary: string };
  action: { primary: string; primaryHover: string; danger: string };
  status: { danger: string; dangerSoft: string; success: string; warning: string };
  line: { subtle: string; control: string };
}

export interface ThemeSurfaces {
  work: { solid: string; enhanced: string; blur: string };
  backdrop: string;
  colorScheme: 'light';
}

export interface ThemeTypography {
  family: string;
  body: string;
  small: string;
  heading: string;
  mobileHeading: string;
  lineHeight: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  status: ThemeStatus;
  semanticColors: ThemeSemanticColors;
  surfaces: ThemeSurfaces;
  typography: ThemeTypography;
  spacing: { small: string; control: string; group: string; section: string };
  radii: { control: string; surface: string };
  elevation: { dialog: string };
  motion: { duration: string; easing: string; decorative: 'none' | 'subtle' };
  artworkByRole: Partial<Record<ArtworkRole, ArtworkAsset>>;
  capabilities: { blur: boolean; reducedMotion: boolean };
}

/** Public theme selection stays closed until every glass page and state is verified. */
export function resolvePublicTheme(): ThemeId { return 'campus'; }
