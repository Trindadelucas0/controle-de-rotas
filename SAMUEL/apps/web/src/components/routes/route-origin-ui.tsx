'use client';

import Link from 'next/link';
import { Marker } from 'react-map-gl/maplibre';
import {
  formatGpsAge,
  type AssignmentStartSource,
  type CompanyOrigin,
} from './routes-planner-shared';

export function companyDisplayName(company: CompanyOrigin) {
  return company.tradeName || company.name;
}

export function CompanyOriginMarker({
  latitude,
  longitude,
  companyName,
}: {
  latitude: number;
  longitude: number;
  companyName: string;
}) {
  return (
    <Marker latitude={latitude} longitude={longitude} anchor="bottom">
      <div className="flex flex-col items-center">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-accent text-[10px] font-bold text-white"
          aria-label={`Origem da empresa: ${companyName}`}
          title={`Empresa (origem) — ${companyName}`}
        >
          E
        </div>
        <span className="mt-0.5 rounded bg-surface px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-800">
          Empresa
        </span>
      </div>
    </Marker>
  );
}

export function EmployeeStartMarker({
  latitude,
  longitude,
  employeeName,
}: {
  latitude: number;
  longitude: number;
  employeeName: string;
}) {
  return (
    <Marker latitude={latitude} longitude={longitude} anchor="bottom">
      <div className="flex flex-col items-center">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-800 text-[10px] font-bold text-white"
          aria-label={`Última localização de ${employeeName}`}
          title={`Funcionário (início) — ${employeeName}`}
        >
          F
        </div>
        <span className="mt-0.5 max-w-[7rem] truncate rounded bg-surface px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-800">
          {employeeName}
        </span>
      </div>
    </Marker>
  );
}

export function RouteMapLegend({
  showEmployeeStart = false,
}: {
  showEmployeeStart?: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute left-3 top-3 z-10 max-w-[17rem] rounded-lg border border-brand-100 bg-surface px-2.5 py-2 text-[11px] leading-snug text-brand-900 shadow"
      role="note"
    >
      {showEmployeeStart ? (
        <p>
          <span className="font-semibold text-brand-800">F</span> = última localização do
          funcionário — início do km e do tempo
        </p>
      ) : null}
      <p className={showEmployeeStart ? 'mt-0.5' : undefined}>
        <span className="font-semibold text-accent">E</span> = pin da empresa
        {showEmployeeStart ? ' (volta, se ligado)' : ' — origem do cálculo'}
      </p>
      <p className="mt-0.5">
        <span className="font-semibold text-brand-800">1, 2…</span> = clientes / visitas
      </p>
    </div>
  );
}

export function RouteOriginStartRow({
  company,
  fallbackNote,
}: {
  company: CompanyOrigin;
  fallbackNote?: string;
}) {
  const name = companyDisplayName(company);
  return (
    <div className="flex items-start gap-2 text-sm">
      <span
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white"
        aria-hidden
      >
        E
      </span>
      <div>
        <p className="font-medium text-brand-900">
          {name} <span className="font-normal text-[var(--muted)]">(origem da empresa)</span>
        </p>
        {company.address ? (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{company.address}</p>
        ) : null}
        {fallbackNote ? (
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">{fallbackNote}</p>
        ) : (
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            O marcador E no mapa sai daqui.{' '}
            <Link href="/settings/company" className="ops-link">
              Alterar em Empresa
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function RouteEmployeeStartRow({
  employeeName,
  source,
  recordedAt,
}: {
  employeeName: string;
  source: AssignmentStartSource;
  recordedAt: string | null;
}) {
  const age = formatGpsAge(recordedAt);
  const sourceLabel =
    source === 'live'
      ? `ao vivo${age.label ? ` · ${age.label}` : ''}`
      : age.label;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-800 text-[10px] font-bold text-white"
        aria-hidden
      >
        F
      </span>
      <div>
        <p className="font-medium text-brand-900">
          {employeeName}{' '}
          <span className="font-normal text-[var(--muted)]">(última localização)</span>
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {sourceLabel || 'posição gravada'}
          {age.stale ? ' · desatualizada (> 24 h)' : ''}
        </p>
      </div>
    </div>
  );
}

export function RouteOriginReturnRow() {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white"
        aria-hidden
      >
        E
      </span>
      <p className="font-medium text-brand-900">
        Volta à empresa
        <span className="block text-xs font-normal text-[var(--muted)]">
          Roundtrip ligado — o traçado termina de novo no marcador E
        </span>
      </p>
    </div>
  );
}
