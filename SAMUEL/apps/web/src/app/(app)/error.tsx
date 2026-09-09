'use client';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-12">
      <h1 className="text-xl font-semibold text-brand-900">Não foi possível abrir esta tela</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Recarregue ou tente de novo. Se persistir, saia e entre novamente.
      </p>
      {error?.message ? (
        <p className="mt-3 text-xs text-[var(--danger)]">{error.message}</p>
      ) : null}
      <button type="button" className="ops-btn ops-btn-primary mt-6" onClick={() => reset()}>
        Tentar de novo
      </button>
    </div>
  );
}
