'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';

const CODE_LABEL: Record<string, string> = {
  KM_DISCREPANCY: 'Km acima do planejado',
  ODOMETER_ROLLBACK: 'Km inicial abaixo do último',
  ODOMETER_GAP: 'Salto de km sem rota',
  OFF_ROUTE: 'Saiu da rota',
};

const FUEL_LABEL: Record<string, string> = {
  EMPTY: 'Vazio',
  QUARTER: '1/4',
  HALF: '1/2',
  THREE_QUARTERS: '3/4',
  FULL: 'Cheio',
};

type Observation = {
  id: string;
  code: string;
  severity: string;
  status: string;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  route: {
    id: string;
    date: string;
    status: string;
    plannedDistanceMeters: number | null;
    actualDistanceMeters: number | null;
    startOdometerKm: number | null;
    endOdometerKm: number | null;
    startFuelLevel: string | null;
    endFuelLevel: string | null;
  };
  vehicle: { id: string; plate: string } | null;
  evidence: { id: string; kind: string; createdAt: string }[];
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

function km(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n} km`;
}

export function EmployeeAuditObservations({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<Observation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const r = await apiFetch<{ observations: Observation[] }>(
        `/api/v1/ops/employees/${employeeId}/observations`,
      );
      setRows(r.observations);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar observações');
      setRows([]);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function markSeen(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/api/v1/ops/employees/${employeeId}/observations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'SEEN' }),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível marcar como vista');
    } finally {
      setBusyId(null);
    }
  }

  if (rows === null && !error) {
    return <div className="mb-6 h-32 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <section className="mb-6 space-y-3 rounded-2xl border border-brand-100 bg-surface p-5">
      <h2 className="text-lg font-semibold text-brand-900">Observações de auditoria</h2>
      <p className="text-xs text-[var(--muted)]">Somente escritório. O funcionário não vê esta lista.</p>
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {rows && rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nenhuma observação de auditoria.</p>
      ) : null}
      <ul className="space-y-3">
        {(rows ?? []).map((o) => (
          <li
            key={o.id}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-brand-900">
                  {CODE_LABEL[o.code] ?? o.code}{' '}
                  <span className="font-normal text-[var(--muted)]">
                    · {o.status === 'OPEN' ? 'Aberta' : 'Vista'}
                  </span>
                </p>
                <p className="text-xs text-[var(--muted)]">{formatWhen(o.createdAt)}</p>
              </div>
              {o.status === 'OPEN' ? (
                <button
                  type="button"
                  disabled={busyId === o.id}
                  onClick={() => void markSeen(o.id)}
                  className="ops-btn ops-btn-secondary text-xs disabled:opacity-60"
                >
                  {busyId === o.id ? 'Salvando…' : 'Marcar como vista'}
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-brand-900">{o.summary}</p>
            <dl className="mt-2 grid gap-1 text-xs text-[var(--muted)] sm:grid-cols-2">
              <div>
                Rota {o.route.date} · {o.vehicle?.plate ?? 'sem placa'}
              </div>
              <div>
                Plan. {km(o.route.plannedDistanceMeters != null ? o.route.plannedDistanceMeters / 1000 : null)}{' '}
                · real {km(o.route.actualDistanceMeters != null ? o.route.actualDistanceMeters / 1000 : null)}
              </div>
              <div>
                Odômetro {o.route.startOdometerKm ?? '—'} → {o.route.endOdometerKm ?? '—'}
              </div>
              <div>
                Combustível {FUEL_LABEL[o.route.startFuelLevel ?? ''] ?? o.route.startFuelLevel ?? '—'} →{' '}
                {FUEL_LABEL[o.route.endFuelLevel ?? ''] ?? o.route.endFuelLevel ?? '—'}
              </div>
            </dl>
            <div className="mt-2 flex flex-wrap gap-2">
              {o.evidence.map((e) => (
                <a
                  key={e.id}
                  href={`/api/v1/routes/${o.route.id}/evidence/${e.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="ops-link text-xs"
                >
                  {e.kind === 'START_ODOMETER' ? 'Foto início' : 'Foto fim'}
                </a>
              ))}
              <Link href="/routes" className="ops-link text-xs">
                Ver rotas
              </Link>
              <Link href={`/map?routeId=${o.route.id}`} className="ops-link text-xs">
                Ver no mapa
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
