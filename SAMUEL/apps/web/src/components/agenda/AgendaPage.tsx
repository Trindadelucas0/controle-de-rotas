'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionUser } from '@/lib/session-context';
import { PageHeader } from '@/components/ui/crud';
import { OperationalSummaryStrip } from '@/components/ops/OperationalSummaryStrip';
import type { AgendaSummary } from '@/lib/ops-types';
import {
  VISIT_STATUS_LABELS,
  dayRangeIso,
  labelOf,
  toDateInputValue,
} from '@/lib/ops-labels';

type AgendaVisit = {
  id: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  status: string;
  customer: { id: string; name: string; tradeName: string | null };
  employee: { id: string; name: string } | null;
  serviceOrder: { id: string; number: number; title: string; status: string };
};

export function AgendaPage() {
  const user = useSessionUser();
  const canOpenOs =
    user?.role === 'ADMIN' ||
    user?.role === 'PLATFORM_ADMIN' ||
    user?.role === 'MANAGER' ||
    user?.role === 'SUPERVISOR';
  const [date, setDate] = useState(toDateInputValue());
  const [visits, setVisits] = useState<AgendaVisit[]>([]);
  const [summary, setSummary] = useState<AgendaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = dayRangeIso(day);
      const params = new URLSearchParams({ from, to });
      const [visitsRes, summaryRes] = await Promise.all([
        apiFetch<{ visits: AgendaVisit[] }>(`/api/v1/visits?${params}`),
        apiFetch<AgendaSummary>(
          `/api/v1/ops/agenda/summary?date=${encodeURIComponent(day)}`,
        ).catch(() => null),
      ]);
      setVisits(visitsRes.visits);
      setSummary(summaryRes);
      setSummaryError(summaryRes ? null : 'KPIs indisponíveis');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar agenda');
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  return (
    <div>
      <PageHeader title="Agenda" subtitle="Visitas do dia" />
      <OperationalSummaryStrip
        loading={loading && !summary}
        error={summaryError}
        items={
          summary
            ? [
                { label: 'Planejadas', value: summary.planned },
                { label: 'Concluídas', value: summary.completed },
                { label: 'Em andamento', value: summary.inProgress },
                { label: 'Atrasadas', value: summary.delayed },
                { label: 'Canceladas', value: summary.cancelled },
              ]
            : []
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="ops-label">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ops-input text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void load(date)}
          className="ops-btn ops-btn-secondary"
        >
          Atualizar
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-surface" />
      ) : visits.length === 0 ? (
        <p className="ops-surface rounded-[10px] border-dashed px-5 py-10 text-center text-sm text-[var(--muted)]">
          Nenhuma visita neste dia. Confira a data ou abra Serviços para agendar.
        </p>
      ) : (
        <ul className="space-y-2">
          {visits.map((v) => (
            <li
              key={v.id}
              className="rounded-2xl border border-brand-100 bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-[var(--muted)]">
                    {new Date(v.scheduledStart).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {labelOf(VISIT_STATUS_LABELS, v.status)}
                  </p>
                  <p className="mt-1 text-base font-semibold text-brand-900">
                    OS #{v.serviceOrder.number} — {v.serviceOrder.title}
                  </p>
                  <p className="mt-1 text-sm text-brand-800">
                    {v.customer.tradeName || v.customer.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {v.employee?.name || 'Sem funcionário atribuído'}
                  </p>
                </div>
                {canOpenOs ? (
                  <Link
                    href={`/services/${v.serviceOrder.id}`}
                    className="ops-btn ops-btn-secondary"
                  >
                    Abrir OS
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
