import styles from './controls.module.css';

export function StatusSegment<T extends string>({ label, options, value, onChange, disabled }: {
  label: string; options: readonly { value: T; label: string }[]; value: T;
  onChange: (value: T) => void; disabled?: boolean;
}) {
  return <div className={styles.segment} role="group" aria-label={label}>
    {options.map(option => <button key={option.value} type="button" disabled={disabled}
      aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
