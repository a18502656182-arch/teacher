'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { publicThemeDefinition } from './definitions';
import type { ThemeDefinition } from './contracts';
import { themeCssVariables } from './cssVariables';
import styles from './theme.module.css';

const ThemeContext = createContext<ThemeDefinition>(publicThemeDefinition);

export function useWorkbenchTheme() { return useContext(ThemeContext); }

/** Updating the material never changes a React key or owns any workspace state. */
export function ThemeBoundary({ children, definition = publicThemeDefinition }: {
  children: ReactNode; definition?: ThemeDefinition;
}) {
  return <ThemeContext.Provider value={definition}>
    <div
      className={styles.root}
      data-ui-generation="next"
      data-theme={definition.id}
      data-theme-status={definition.status}
      data-theme-blur={definition.capabilities.blur ? 'available' : 'none'}
      data-reduced-motion={definition.capabilities.reducedMotion ? 'supported' : 'none'}
      style={themeCssVariables(definition)}
    >
      {children}
    </div>
  </ThemeContext.Provider>;
}
