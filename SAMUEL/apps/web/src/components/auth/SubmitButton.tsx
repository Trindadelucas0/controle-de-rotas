'use client';

type Props = {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function SubmitButton({ children, loading, disabled, className = '' }: Props) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={`ops-btn ops-btn-primary min-w-[8.5rem] ${className}`}
    >
      {loading ? (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden
        />
      ) : null}
      <span>{loading ? 'Aguarde…' : children}</span>
    </button>
  );
}
