'use client';

import { useEffect, useState } from 'react';
import { ROUTE_COMPLETE_REMAINING_TOLERANCE_METERS } from '@/lib/route-complete';
import { FUEL_LEVEL_OPTIONS } from '@/lib/field-fuel';
import { OdometerPhotoCapture } from '@/components/field/OdometerPhotoCapture';

export type CompleteRoutePayload = {
  endOdometerKm: number;
  endFuelLevel: (typeof FUEL_LEVEL_OPTIONS)[number]['value'];
  file: File;
};

type Props = {
  pendingCount: number;
  totalStops: number;
  remainingMeters: number | null;
  asFinished: boolean;
  busy?: boolean;
  error?: string | null;
  suggestedOdometerKm?: number | null;
  suggestedFuelLevel?: string | null;
  recordMission?: { pointCount: number };
  onCancel: () => void;
  onConfirm: (payload: CompleteRoutePayload) => void;
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
  suggestedOdometerKm,
  suggestedFuelLevel,
  recordMission,
  onCancel,
  onConfirm,
}: Props) {
  const done = totalStops - pendingCount;
  const [endKm, setEndKm] = useState(
    suggestedOdometerKm != null ? String(suggestedOdometerKm) : '',
  );
  const [fuel, setFuel] = useState<(typeof FUEL_LEVEL_OPTIONS)[number]['value']>(
    FUEL_LEVEL_OPTIONS.some((o) => o.value === suggestedFuelLevel)
      ? (suggestedFuelLevel as (typeof FUEL_LEVEL_OPTIONS)[number]['value'])
      : 'HALF',
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (suggestedOdometerKm != null) setEndKm(String(suggestedOdometerKm));
  }, [suggestedOdometerKm]);

  function submit() {
    const km = Number(endKm.replace(',', '.'));
    if (!Number.isFinite(km) || km < 0) {
      setLocalError('Informe o km final do veículo.');
      return;
    }
    if (!photo) {
      setLocalError('Tire uma foto do odômetro para concluir.');
      return;
    }
    setLocalError(null);
    onConfirm({ endOdometerKm: km, endFuelLevel: fuel, file: photo });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-route-title"
    >
      <div className="w-full max-w-sm rounded-[10px] border border-[var(--border)] bg-surface p-5 text-brand-900 shadow-lg">
        <h2 id="complete-route-title" className="text-lg font-semibold">
          {recordMission ? 'Encerrar gravação?' : 'Concluir rota?'}
        </h2>
        {recordMission ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {recordMission.pointCount} cliente(s) marcado(s). A rota fecha. Cadastros em aberto
            continuam com lápis no mapa.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Situação: {done} de {totalStops} parada(s) feitas
            {pendingCount > 0 ? ` · ${formatRemaining(remainingMeters)}` : ''}.
          </p>
        )}

        {recordMission ? (
          <p className="mt-3 text-sm text-brand-900">
            Finalizar não pede nome e não cria cliente neste gesto. Os pontos já marcados
            permanecem.
          </p>
        ) : asFinished ? (
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

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Km final *</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={endKm}
              disabled={busy}
              onChange={(e) => setEndKm(e.target.value)}
              className="w-full ops-input"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Combustível *</span>
            <select
              value={fuel}
              disabled={busy}
              onChange={(e) =>
                setFuel(e.target.value as (typeof FUEL_LEVEL_OPTIONS)[number]['value'])
              }
              className="w-full ops-input"
            >
              {FUEL_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <OdometerPhotoCapture
            id="end-odometer-photo"
            file={photo}
            onChange={setPhoto}
            required
            disabled={busy}
          />
        </div>

        {localError || error ? (
          <p
            className="mt-3 rounded-[6px] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]"
            role="alert"
          >
            {localError || error}
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
            disabled={busy || !photo}
            onClick={submit}
            className="ops-btn ops-btn-primary flex-1 disabled:opacity-60"
          >
            {busy ? 'Concluindo…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
