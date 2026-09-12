'use client';

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { RoutesTodayView } from '@/components/routes/RoutesTodayView';

const RoutesPlanner = dynamic(
  () => import('@/components/routes/RoutesPlanner').then((m) => m.RoutesPlanner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-8.5rem)] min-h-[420px] items-center justify-center rounded-[10px] border border-[var(--border)] bg-surface text-sm text-[var(--muted)]">
        Carregando planejador de rotas…
      </div>
    ),
  },
);

type Tab = 'today' | 'planner';

export default function RoutesPage() {
  const [tab, setTab] = useState<Tab>('today');

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-brand-900">Rotas</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Planejamento, execução e monitoramento do dia (E → paradas → E).
      </p>

      <div
        role="tablist"
        aria-label="Contexto de rotas"
        className="mb-5 inline-flex rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'today'}
          onClick={() => setTab('today')}
          className={`rounded-[6px] px-4 py-1.5 text-sm font-semibold transition ${
            tab === 'today' ? 'bg-accent text-white' : 'text-[var(--muted)] hover:text-brand-900'
          }`}
        >
          Rotas de hoje
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'planner'}
          onClick={() => setTab('planner')}
          className={`rounded-[6px] px-4 py-1.5 text-sm font-semibold transition ${
            tab === 'planner' ? 'bg-accent text-white' : 'text-[var(--muted)] hover:text-brand-900'
          }`}
        >
          Planejador
        </button>
      </div>

      {tab === 'today' ? (
        <RoutesTodayView />
      ) : (
        <>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Escolha clientes e funcionários com login; o sistema divide, otimiza e publica as
            rotas. O modo Visitas agendadas continua disponível para o fluxo por OS.
          </p>
          <Suspense
            fallback={
              <div className="h-40 animate-pulse rounded-[10px] bg-surface" aria-busy="true" />
            }
          >
            <RoutesPlanner />
          </Suspense>
        </>
      )}
    </div>
  );
}
