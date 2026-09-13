import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './controls.module.css';

export function SelectionBar({ count, scopeLabel, busy, actions, onClear }: {
  count: number; scopeLabel: string; busy?: boolean; actions: ReactNode; onClear: () => void;
}) {
  if (count === 0) return null;
  return <div className={styles.selection} role="region" aria-label="批量操作" aria-busy={busy || undefined}>
    <span aria-live="polite">已选 <strong>{count}</strong> 人<small>{scopeLabel}</small></span>
    <div className={styles.actions}>{actions}<Button intent="text" disabled={busy} onClick={onClear}>清空选择</Button></div>
  </div>;
}
