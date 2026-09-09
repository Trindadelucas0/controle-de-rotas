'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api-client';
import { isPwaStandalone } from '@/lib/pwa';

type TrackingStatus = {
  trackingActive: boolean;
  transport: string;
  hint: string;
  route: {
    id: string;
    status: string;
    startedAt: string | null;
    vehicle: { id: string; plate: string } | null;
  } | null;
};

export function FieldTrackingStatusPage() {
  const [data, setData] = useState<TrackingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<string>('Checando permissão…');
  const [pwa, setPwa] = useState<string>('Checando app…');

  useEffect(() => {
    let cancelled = false;
    apiFetch<TrackingStatus>('/api/v1/field/tracking-status')
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Falha ao carregar status');
      });

    if (!navigator.geolocation) {
      setGeo('Geolocation não suportada');
    } else {
      navigator.permissions
        ?.query({ name: 'geolocation' as PermissionName })
        .then((p) => setGeo(`Permissão GPS: ${p.state}`))
        .catch(() => setGeo('Permissão GPS: consulte o navegador'));
    }

    setPwa(isPwaStandalone() ? 'App instalado (tela inicial)' : 'Navegador em aba — GPS bloqueado no campo');

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-brand-900">Status do GPS</h1>
        <Link href="/field/my-route" className="text-sm ops-link">
          ← Minha rota
        </Link>
      </div>

      {error ? (
        <p className="rounded-[6px] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      <div className="rounded-2xl border border-brand-100 bg-surface p-5 text-sm">
        <p className="font-semibold text-brand-900">Transporte</p>
        <p className="mt-1 text-[var(--muted)]">
          Localização via <strong>HTTP</strong> (`POST /tracking/points`). Sem WebSocket neste bloco.
        </p>
        <p className="mt-3 font-semibold text-brand-900">Sessão</p>
        <p className="mt-1 text-[var(--muted)]">
          {data
            ? data.trackingActive
              ? `Ativa · rota ${data.route?.id.slice(0, 8)}… · veículo ${data.route?.vehicle?.plate ?? '—'}`
              : 'Inativa — inicie a rota com Play'
            : 'Carregando…'}
        </p>
        <p className="mt-3 font-semibold text-brand-900">App</p>
        <p className="mt-1 text-[var(--muted)]">{pwa}</p>
        <p className="mt-3 font-semibold text-brand-900">Navegador</p>
        <p className="mt-1 text-[var(--muted)]">{geo}</p>
        {data?.hint ? <p className="mt-3 text-xs text-[var(--muted)]">{data.hint}</p> : null}
      </div>
    </section>
  );
}
