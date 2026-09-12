import type { ComponentPropsWithRef } from 'react';
import styles from './controls.module.css';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  intent?: 'primary' | 'secondary' | 'text' | 'danger';
  busy?: boolean;
};

export function Button({ intent = 'secondary', busy = false, disabled, className = '',
  type = 'button', children, ...props }: ButtonProps) {
  return <button {...props} type={type} className={`${styles.button} ${className}`}
    data-intent={intent} disabled={disabled || busy} aria-busy={busy || undefined}>
    {children}
  </button>;
}
