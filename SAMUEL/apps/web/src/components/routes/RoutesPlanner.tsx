'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { CompanyOrigin } from './routes-planner-shared';
import { RoutesPlannerCustomers } from './RoutesPlannerCustomers';
import { RoutesPlannerVisits } from './RoutesPlannerVisits';
import { RoutesPlannerRecordMission } from './RoutesPlannerRecordMission';
import { RoutesPlannerRegionMission } from './RoutesPlannerRegionMission';

type PlannerMode = 'customers' | 'visits' | 'record' | 'region';

export function RoutesPlanner() {
  const searchParams = useSearchParams();
  const preselectCustomerId = searchParams.get('customerId');
  const [mode, setMode] = useState<PlannerMode>('customers');
  const [company, setCompany] = useState<CompanyOrigin | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectCustomerId) setMode('customers');
  }, [preselectCustomerId]);

  useEffect(() => {
    setLoadingCompany(true);
    apiFetch<{ company: CompanyOrigin }>('/api/v1/companies/me')
      .then((r) => {
        setCompany(r.company);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha ao carregar empresa'))
      .finally(() => setLoadingCompany(false));
  }, []);

  if (loadingCompany) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface" />;
  }

  if (error && !company) {
    return <p className="text-sm text-[var(--danger)]">{error}</p>;
  }

  const hasOrigin =
    company != null && company.latitude != null && company.longitude != null;

  if (!hasOrigin || !company) {
    return (
      <div className="rounded-[10px] border border-[var(--warn)]/40 bg-[var(--warn-bg)] p-6 text-sm text-[var(--warn)]">
        <p className="font-semibold">Origem da empresa ainda sem pin no mapa.</p>
        <p className="mt-2">
          Cadastre o endereço e marque o local em{' '}
          <Link href="/settings/company" className="font-semibold underline">
            Configurações → Empresa
          </Link>{' '}
          para calcular e publicar rotas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Modo do planejador"
        className="ops-tabs flex w-full max-w-full overflow-x-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'customers'}
          onClick={() => setMode('customers')}
          className="ops-tab shrink-0"
        >
          Clientes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'visits'}
          onClick={() => setMode('visits')}
          className="ops-tab shrink-0"
        >
          Visitas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'record'}
          onClick={() => setMode('record')}
          className="ops-tab shrink-0"
        >
          Gravar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'region'}
          onClick={() => setMode('region')}
          className="ops-tab shrink-0"
        >
          Região
        </button>
      </div>

      {mode === 'customers' ? (
        <RoutesPlannerCustomers company={company} preselectCustomerId={preselectCustomerId} />
      ) : mode === 'visits' ? (
        <RoutesPlannerVisits company={company} />
      ) : mode === 'record' ? (
        <RoutesPlannerRecordMission companyName={company.tradeName || company.name} />
      ) : (
        <RoutesPlannerRegionMission />
      )}
    </div>
  );
}
