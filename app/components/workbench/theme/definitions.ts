import { resolvePublicTheme, type ArtworkAsset, type ThemeDefinition } from './contracts';

const artwork = (src: string, width: number, height: number, options: Partial<Pick<ArtworkAsset, 'mobileSrc' | 'fit' | 'focalPoint' | 'safeTextArea'>> = {}): ArtworkAsset => ({
  src,
  mobileSrc: options.mobileSrc,
  width,
  height,
  fit: options.fit ?? 'contain',
  focalPoint: options.focalPoint ?? [50, 50],
  safeTextArea: options.safeTextArea ?? 'none',
  decorative: true,
  fallback: 'none',
  status: 'candidate',
});

const sharedStructure = {
  typography: {
    family: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
    body: '16px',
    small: '13px',
    heading: '32px',
    mobileHeading: '26px',
    lineHeight: '1.6',
  },
  spacing: { small: '8px', control: '12px', group: '16px', section: '24px' },
  radii: { control: '10px', surface: '18px' },
  capabilities: { blur: false, reducedMotion: true },
} as const;

export const campusTheme = {
  id: 'campus',
  status: 'development',
  ...sharedStructure,
  semanticColors: {
    surface: { canvas: '#fffdf8', context: '#eaf5fc', assist: '#edf6ef', attention: '#fff1d4', disabled: '#e9edf0' },
    text: { main: '#17354a', muted: '#526a7b', onPrimary: '#ffffff' },
    action: { primary: '#14778a', primaryHover: '#106575', danger: '#b4233d' },
    status: { danger: '#b4233d', dangerSoft: '#fcecef', success: '#245f43', warning: '#80500a' },
    line: { subtle: '#cbdce6', control: '#8aa4b5' },
  },
  surfaces: { work: { solid: '#ffffff', enhanced: '#ffffff', blur: '0px' }, backdrop: '#17354a66', colorScheme: 'light' },
  elevation: { dialog: '0 16px 56px #17354a30' },
  motion: { duration: '120ms', easing: 'ease-out', decorative: 'none' },
  artworkByRole: {
    'home.scene': artwork('/art/campus/home-scene-v3.webp', 1200, 800, { mobileSrc: '/art/campus/home-scene-mobile-v3.webp', fit: 'cover', focalPoint: [72, 50], safeTextArea: 'left' }),
    'entry.scene': artwork('/art/campus/classroom-morning.webp', 960, 640, { fit: 'cover', safeTextArea: 'left' }),
    'dictation.context': artwork('/art/campus/dictation-context-v2.webp', 1200, 800, { mobileSrc: '/art/campus/dictation-context-mobile-v2.webp', fit: 'cover', focalPoint: [74, 50], safeTextArea: 'left' }),
    'dictation.grading': artwork('/art/campus/dictation-stationery-v2.webp', 1666, 944, { fit: 'cover', focalPoint: [85, 50], safeTextArea: 'left' }),
    'student.detail': artwork('/art/campus/student-detail-v2.webp', 1200, 800, { mobileSrc: '/art/campus/student-detail-mobile-v2.webp', fit: 'cover', focalPoint: [70, 50], safeTextArea: 'left' }),
    'homework.context': artwork('/art/campus/homework-context-v2.webp', 1200, 800, { mobileSrc: '/art/campus/homework-context-mobile-v2.webp', fit: 'cover', focalPoint: [72, 50], safeTextArea: 'left' }),
    'assessment.context': artwork('/art/campus/assessment-review.webp', 1100, 733),
    'planning.context': artwork('/art/campus/class-planner.webp', 1100, 733),
    'duty.context': artwork('/art/campus/duty-cleaning.webp', 1100, 733),
    'organization.context': artwork('/art/campus/cadres-responsibility.webp', 1100, 733),
    'care.context': artwork('/art/campus/student-records.webp', 1100, 733),
    'communication.context': artwork('/art/campus/student-records.webp', 1100, 733),
    'tools.context': artwork('/art/campus/class-planner.webp', 1100, 733),
    'family.context': artwork('/art/campus/family-study.webp', 1100, 733),
    'admin.context': artwork('/art/campus/class-planner.webp', 1100, 733),
    'empty.first-use': artwork('/art/campus/word-cards.webp', 600, 400),
    'empty.no-results': artwork('/art/campus/word-cards.webp', 600, 400),
  },
} satisfies ThemeDefinition;

/** Architecture probe only. It has complete tokens but no borrowed campus artwork. */
export const glassTheme = {
  id: 'glass',
  status: 'planned',
  ...sharedStructure,
  capabilities: { blur: false, reducedMotion: true },
  semanticColors: {
    surface: { canvas: '#f1f4ff', context: '#edf1ff', assist: '#eef5fa', attention: '#fff1d4', disabled: '#e8ebf4' },
    text: { main: '#17264f', muted: '#526484', onPrimary: '#ffffff' },
    action: { primary: '#315deb', primaryHover: '#244bc8', danger: '#a52243' },
    status: { danger: '#a52243', dangerSoft: '#fcecf2', success: '#245f43', warning: '#80500a' },
    line: { subtle: '#cbd4e6', control: '#8495b5' },
  },
  surfaces: { work: { solid: '#ffffff', enhanced: '#ffffff', blur: '0px' }, backdrop: '#17264f66', colorScheme: 'light' },
  elevation: { dialog: '0 20px 64px #17264f2e' },
  motion: { duration: '140ms', easing: 'ease-out', decorative: 'none' },
  artworkByRole: {},
} satisfies ThemeDefinition;

export const themeDefinitions = { campus: campusTheme, glass: glassTheme } as const;
export const publicThemeDefinition: ThemeDefinition = themeDefinitions[resolvePublicTheme()];
