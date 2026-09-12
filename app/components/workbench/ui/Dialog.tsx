'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './dialog.module.css';

export type CloseReason = 'escape' | 'backdrop' | 'button';

/** The controller handles dirty drafts for every close path. Native modal manages focus/inert. */
export function Dialog({ open, title, children, footer, busy = false, dirty = false, onRequestClose }: {
  open: boolean; title: string; children: ReactNode; footer?: ReactNode;
  busy?: boolean; dirty?: boolean; onRequestClose: (reason: CloseReason) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const backdropStarted = useRef(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!open) { if (element.open) element.close(); return; }
    const trigger = document.activeElement;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [open]);
  function request(reason: CloseReason) { if (!busy) onRequestClose(reason); }
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={heading}
    aria-busy={busy || undefined} data-dirty={dirty} data-workbench-dialog="next"
    onCancel={event => { event.preventDefault(); request('escape'); }}
    onPointerDown={event => { backdropStarted.current = event.target === event.currentTarget; }}
    onClick={event => { if (event.target === event.currentTarget && backdropStarted.current) request('backdrop'); backdropStarted.current = false; }}>
    <div className={styles.frame}>
      <header className={styles.header}><h2 id={heading}>{title}</h2><Button intent="text" disabled={busy} onClick={() => request('button')}>关闭</Button></header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  </dialog>;
}
