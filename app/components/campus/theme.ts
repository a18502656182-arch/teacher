export type ThemeName = 'campus' | 'glass';
export type ArtworkSlot = 'dashboard' | 'dictation' | 'roster' | 'homework' | 'assessment' | 'planning' | 'duty' | 'care' | 'communication' | 'tools' | 'empty';
export type ThemeConfig = { status: 'development' | 'ready' | 'planned'; artwork: Partial<Record<ArtworkSlot,string>> };
export const themes: Record<ThemeName, ThemeConfig> = {
  campus: { status: 'ready', artwork: {
    dashboard: '/art/campus/classroom-morning.webp',
    dictation: '/art/campus/word-cards.webp',
    roster: '/art/campus/student-records.webp',
    homework: '/art/campus/homework-books.webp',
    assessment: '/art/campus/assessment-review.webp',
    planning: '/art/campus/class-planner.webp',
    duty: '/art/campus/duty-cleaning.webp',
    care: '/art/campus/student-records.webp',
    communication: '/art/campus/student-records.webp',
    tools: '/art/campus/class-planner.webp',
    empty: '/art/campus/word-cards.webp',
  } },
  glass: { status: 'planned', artwork: {} },
};
// Unreleased/unknown preferences fall back synchronously; no business-tree remount or theme switch UI.
export function resolveTheme(): ThemeName { return 'campus'; }
