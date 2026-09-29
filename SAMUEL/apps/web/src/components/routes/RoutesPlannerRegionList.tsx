'use client';

import { useMemo, useState } from 'react';
import type { CustomerRegionPin } from '@/components/map/CustomerRegionCircles';
import { formatRegionKm } from '@/lib/region-circle';

export type RegionListItem = CustomerRegionPin & { customerCount: number };

type Props = {
  regions: RegionListItem[];
  selectedId: string | null;
  canSave: boolean;
  onSelect: (region: RegionListItem) => void;
  onDispatch: (region: RegionListItem) => void;
  onEdit: (region: RegionListItem) => void;
  onCreate: () => void;
};

const SEARCH_MIN_REGIONS = 7;

function searchKey(value: string): string {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function regionMeta(region: RegionListItem): string {
  const count =
    region.customerCount === 0
      ? 'Nenhum cliente'
      : `${region.customerCount} cliente${region.customerCount === 1 ? '' : 's'}`;
  return `Raio ${formatRegionKm(region.radiusMeters)} · ${count}`;
}

export function RoutesPlannerRegionList({
  regions,
  selectedId,
  canSave,
  onSelect,
  onDispatch,
  onEdit,
  onCreate,
}: Props) {
  const [query, setQuery] = useState('');
  const showSearch = regions.length >= SEARCH_MIN_REGIONS;

  const visible = useMemo(() => {
    const q = showSearch ? searchKey(query.trim()) : '';
    if (!q) return regions;
    return regions.filter((region) => searchKey(region.name).includes(q));
  }, [regions, query, showSearch]);

  return (
    <div className="flex flex-col gap-3">
      {canSave ? (
        <button type="button" className="ops-btn ops-btn-primary w-full" onClick={onCreate}>
          + Nova região
        </button>
      ) : null}

      {showSearch ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar região…"
          aria-label="Buscar região"
          className="w-full ops-input text-sm"
          autoComplete="off"
        />
      ) : null}

      <div>
        <p className="mb-1 text-sm font-medium text-brand-900">Regiões salvas ({regions.length})</p>
        {regions.length === 0 ? (
          <p className="rounded-[8px] border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
            Nenhuma região salva. Use + Nova região.
          </p>
        ) : visible.length === 0 ? (
          <p className="rounded-[8px] border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)]">
            Nenhuma região com esse nome.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((region) => {
              const selected = region.id === selectedId;
              return (
                <li
                  key={region.id}
                  aria-current={selected ? 'true' : undefined}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    selected ? 'border-accent bg-accent/10' : 'border-brand-100 hover:bg-brand-50'
                  }`}
                >
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => onSelect(region)}
                  >
                    <span
                      className={`block truncate text-brand-900 ${
                        selected ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {region.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {regionMeta(region)}
                    </span>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="ops-btn ops-btn-primary px-3 text-xs"
                      onClick={() => onDispatch(region)}
                    >
                      Enviar para visitar
                    </button>
                    {canSave ? (
                      <button
                        type="button"
                        className="ops-btn ops-btn-secondary px-3 text-xs"
                        onClick={() => onEdit(region)}
                      >
                        Editar
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
