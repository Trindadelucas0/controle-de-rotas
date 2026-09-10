'use client';

import { BusySpinner } from './BusySpinner';

type Props = {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  loadingLabel?: string;
};

export function SubmitButton({
  children,
  loading,
  disabled,
  className = '',
  loadingLabel = 'Aguarde…',
}: Props) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`ops-btn ops-btn-primary min-w-[8.5rem] ${className}`}
    >
      {loading ? <BusySpinner /> : null}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
}
