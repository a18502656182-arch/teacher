'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Button } from './Button';
import styles from './dialog.module.css';

export type CloseReason = 'escape' | 'backdrop' | 'button';

export type ModalLayerProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  dirty?: boolean;
  size?: 'default' | 'wide';
  presentation?: 'dialog' | 'drawer';
  drawerPlacement?: 'end' | 'bottom';
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onRequestClose: (reason: CloseReason) => void;
};

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/** Shared native top-layer behavior. Controllers still decide whether dirty data may close. */
export function ModalLayer({
  open,
  title,
  description,
  children,
  footer,
  busy = false,
  dirty = false,
  size = 'default',
  presentation = 'dialog',
  drawerPlacement = 'end',
  initialFocusRef,
  returnFocusRef,
  onRequestClose,
}: ModalLayerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const descriptionId = useId();
  const backdropStarted = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!open) {
      if (element.open) element.close();
      return;
    }

    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const explicitReturnTarget = returnFocusRef?.current;
    if (!element.open) element.showModal();
    if (bodyRef.current) bodyRef.current.scrollTop = 0;

    const frame = window.requestAnimationFrame(() => {
      const requested = initialFocusRef?.current;
      const autofocus = element.querySelector<HTMLElement>('[autofocus]');
      const first = element.querySelector<HTMLElement>(FOCUSABLE);
      (requested ?? autofocus ?? first ?? headingRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (element.open) element.close();
      const target = explicitReturnTarget ?? triggerRef.current;
      window.requestAnimationFrame(() => {
        const hiddenDialog = target?.closest('dialog:not([open])');
        if (target?.isConnected && !hiddenDialog) target.focus();
      });
    };
  }, [initialFocusRef, open, returnFocusRef]);

  function request(reason: CloseReason) {
    if (!busy) onRequestClose(reason);
  }

  return <dialog
    ref={ref}
    className={styles.dialog}
    aria-labelledby={headingId}
    aria-describedby={description ? descriptionId : undefined}
    data-size={size}
    data-presentation={presentation}
    data-placement={presentation === 'drawer' ? drawerPlacement : undefined}
    aria-busy={busy || undefined}
    data-dirty={dirty}
    data-workbench-dialog="next"
    onCancel={event => {
      event.preventDefault();
      request('escape');
    }}
    onPointerDown={event => {
      backdropStarted.current = event.target === event.currentTarget;
    }}
    onClick={event => {
      if (event.target === event.currentTarget && backdropStarted.current) request('backdrop');
      backdropStarted.current = false;
    }}
  >
    <div className={styles.frame}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 ref={headingRef} id={headingId} tabIndex={-1}>{title}</h2>
          {description && <p id={descriptionId}>{description}</p>}
        </div>
        <Button intent="text" disabled={busy} aria-label={`关闭${title}`} onClick={() => request('button')}>关闭</Button>
      </header>
      <div ref={bodyRef} className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  </dialog>;
}
