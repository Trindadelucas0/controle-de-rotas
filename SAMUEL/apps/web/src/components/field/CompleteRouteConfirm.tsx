'use client';

import { ROUTE_COMPLETE_REMAINING_TOLERANCE_METERS } from '@/lib/route-complete';

type Props = {
  pendingCount: number;
  totalStops: number;
  remainingMeters: number | null;
  asFinished: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

function formatRemaining(meters: number | null): string {
  if (meters == null) return 'distância restante desconhecida';
  if (meters < 1000) return `~${meters} m restantes`;
  return `~${(meters / 1000).toFixed(1)} km restantes`;
}

export function CompleteRouteConfirm({
  pendingCount,
  totalStops,
  remainingMeters,
  asFinished,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const done = totalStops - pendingCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-route-title"
    >
      <div className="w-full max-w-sm rounded-[10px] border border-[var(--border)] bg-surface p-5 text-brand-900 shadow-lg">
        <h2 id="complete-route-title" className="text-lg font-semibold">
          Concluir rota?
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Situação: {done} de {totalStops} parada(s) feitas
          {pendingCount > 0 ? ` · ${formatRemaining(remainingMeters)}` : ''}.
        </p>

        {asFinished ? (
          <p className="mt-3 text-sm text-brand-900">
            {pendingCount === 0
              ? 'Todas as paradas foram feitas. Tem certeza que deseja concluir como finalizada?'
              : `Restante ≤ ${ROUTE_COMPLETE_REMAINING_TOLERANCE_METERS} m. Tem certeza que deseja concluir como finalizada?`}
          </p>
        ) : (
          <p className="mt-3 text-sm text-brand-900">
            Ainda há {pendingCount} parada(s) pendente(s) (
            {formatRemaining(remainingMeters)}). Finalizar como incompleta encerra o dia e avisa o
            gestor, com o mapa da trilha percorrida.
          </p>
        )}

        {error ? (
          <p className="mt-3 rounded-[6px] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="ops-btn ops-btn-secondary flex-1 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="ops-btn ops-btn-primary flex-1 disabled:opacity-60"
          >
            {busy
              ? 'Enviando…'
              : asFinished
                ? 'Sim, concluir'
                : 'Sim, incompleta'}
          </button>
        </div>
      </div>
    </div>
  );
}
