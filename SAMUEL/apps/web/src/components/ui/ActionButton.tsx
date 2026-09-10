'use client';

import { BusySpinner } from './BusySpinner';

type Props = {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  loadingLabel?: string;
  type?: 'button' | 'submit';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  /** primary = ops-btn-primary; secondary = ops-btn outline */
  variant?: 'primary' | 'secondary';
};

export function ActionButton({
  children,
  loading,
  disabled,
  className = '',
  loadingLabel = 'Aguarde…',
  type = 'button',
  onClick,
  title,
  variant = 'primary',
}: Props) {
  const variantClass = variant === 'primary' ? 'ops-btn-primary' : '';
  return (
    <button
      type={type}
      title={title}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
      className={`ops-btn ${variantClass} min-w-[8.5rem] ${className}`}
    >
      {loading ? (
        <BusySpinner
          className={
            variant === 'primary' ? '' : 'border-[var(--muted)]/40 border-t-brand-700'
          }
        />
      ) : null}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
}
