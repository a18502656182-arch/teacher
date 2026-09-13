'use client';

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './controls.module.css';

export function Menu({ label, children, align = 'start', disabled = false }: {
  label: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  function items() {
    return [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
  }

  function openAndFocus(position = 0) {
    if (disabled) return;
    setOpen(true);
    window.requestAnimationFrame(() => {
      const available = items();
      available.at(position) ? available.at(position)?.focus() : available[0]?.focus();
    });
  }

  function closeAndFocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  return <div ref={rootRef} className={styles.menu} data-align={align}>
    <Button
      ref={triggerRef}
      disabled={disabled}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={() => open ? setOpen(false) : openAndFocus()}
      onKeyDown={event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); openAndFocus(); }
        if (event.key === 'ArrowUp') { event.preventDefault(); openAndFocus(-1); }
      }}
    >{label}</Button>
    {open && <div
      id={menuId}
      className={styles.menuPanel}
      role="menu"
      onClick={event => {
        const target = event.target instanceof Element ? event.target.closest('[role="menuitem"]') : null;
        if (target && !(target as HTMLButtonElement).disabled) setOpen(false);
      }}
      onKeyDown={event => {
        const available = items();
        const current = available.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'Escape') { event.preventDefault(); closeAndFocus(); return; }
        if (event.key === 'Tab') { setOpen(false); return; }
        let next: number | null = null;
        if (event.key === 'ArrowDown') next = current < available.length - 1 ? current + 1 : 0;
        if (event.key === 'ArrowUp') next = current > 0 ? current - 1 : available.length - 1;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = available.length - 1;
        if (next !== null) { event.preventDefault(); available[next]?.focus(); }
      }}
    >{children}</div>}
  </div>;
}

export function MenuItem({ children, onSelect, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
  children: ReactNode;
  onSelect: () => void;
}) {
  return <button {...props} type="button" role="menuitem" tabIndex={-1} className={`${styles.menuItem} ${props.className ?? ''}`} onClick={onSelect}>{children}</button>;
}
