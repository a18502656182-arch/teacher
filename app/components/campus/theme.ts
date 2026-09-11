export type ThemeName = 'campus' | 'glass';
export type ArtworkSlot = 'dashboard' | 'dictation' | 'roster' | 'homework' | 'empty';
export type ThemeConfig = { status: 'development' | 'ready' | 'planned'; artwork: Partial<Record<ArtworkSlot,string>> };
export const themes: Record<ThemeName, ThemeConfig> = {
  campus: { status: 'development', artwork: { dashboard: '/art/campus/classroom-morning.webp', dictation: '/art/campus/word-cards.webp', roster: '/art/campus/study-desk.webp', homework: '/art/campus/study-desk.webp', empty: '/art/campus/word-cards.webp' } },
  glass: { status: 'planned', artwork: {} },
};
// Unreleased/unknown preferences fall back synchronously; no business-tree remount or theme switch UI.
export function resolveTheme(): ThemeName { return 'campus'; }
