import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './controls.module.css';

export function Field({ id, label, hint, error, required, children }: {
  id: string; label: string; hint?: string; error?: string; required?: boolean;
  children: ReactNode;
}) {
  return <div className={styles.field}>
    <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    {children}
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    {error && <small id={`${id}-error`} className={styles.error} role="alert">{error}</small>}
  </div>;
}

type FieldState = { error?: string; hint?: string };
function description(id: string | undefined, props: FieldState, existing?: string) {
  return [existing, id && props.hint && `${id}-hint`, id && props.error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}
export function Input({ error, hint, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & FieldState) {
  return <input {...props} className={`${styles.input} ${className}`} aria-invalid={Boolean(error) || props['aria-invalid']}
    aria-describedby={description(props.id, { error, hint }, props['aria-describedby'])}/>;
}
export function Textarea({ error, hint, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldState) {
  return <textarea {...props} className={`${styles.input} ${styles.textarea} ${className}`} aria-invalid={Boolean(error) || props['aria-invalid']}
    aria-describedby={description(props.id, { error, hint }, props['aria-describedby'])}/>;
}
export function Select({ error, hint, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement> & FieldState) {
  return <select {...props} className={`${styles.input} ${className}`} aria-invalid={Boolean(error) || props['aria-invalid']}
    aria-describedby={description(props.id, { error, hint }, props['aria-describedby'])}/>;
}
