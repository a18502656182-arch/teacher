import type { ThemeDefinition } from './contracts';

export const campusTheme: ThemeDefinition = {
  id: 'campus', status: 'development',
  // Assets are assigned only after their actual containers have been reviewed.
  artworkByRole: {
    'dictation.context': { src: '/art/campus/dictation-stationery-v2.png', width: 1666, height: 944, fit: 'cover', focalPoint: [85, 50], safeTextArea: 'left', decorative: true, status: 'candidate' },
  },
  capabilities: { blur: false, reducedMotion: true },
};

/** Architecture probe only. Not a second product or a public theme option. */
export const glassTheme: ThemeDefinition = {
  id: 'glass', status: 'planned', artworkByRole: {},
  capabilities: { blur: true, reducedMotion: true },
};
