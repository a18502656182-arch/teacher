'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { campusTheme } from './definitions';
import type { ThemeDefinition } from './contracts';
import styles from './theme.module.css';

const ThemeContext = createContext<ThemeDefinition>(campusTheme);

export function useWorkbenchTheme() { return useContext(ThemeContext); }

/** Updating the material never changes a React key or owns any workspace state. */
export function ThemeBoundary({ children, definition = campusTheme }: {
  children: ReactNode; definition?: ThemeDefinition;
}) {
  return <ThemeContext.Provider value={definition}>
    <div className={styles.root} data-ui-generation="next" data-theme={definition.id}>
      {children}
    </div>
  </ThemeContext.Provider>;
}
