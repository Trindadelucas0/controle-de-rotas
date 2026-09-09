'use client';

import { useState } from 'react';

type Props = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
};

export function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  disabled,
  error,
  required,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="ops-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className="ops-input pr-12 disabled:opacity-60"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-accent"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          disabled={disabled}
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
