import { iconPaths } from './icons';

/** One SVG geometry registry for both generations during migration. */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false"><path d={iconPaths[name] ?? iconPaths.book}/></svg>;
}
