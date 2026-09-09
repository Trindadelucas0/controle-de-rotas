'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { DataTable, FieldGrid, FormCard, FormSection, PageHeader, SelectField, TextField } from '@/components/ui/crud';
import {
  OperationalSummaryStrip,
  summaryKm,
} from '@/components/ops/OperationalSummaryStrip';
import { EntityContextPanel } from '@/components/ops/EntityContextPanel';
import { formatMetersKm, type EntityContextCard, type VehiclesSummary } from '@/lib/ops-types';

export type VehicleDto = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  fuelType: string | null;
  avgConsumption: number | null;
  capacity: number | null;
  odometerKm: number | null;
  status: string;
};

const statusOpts = [
  { value: 'AVAILABLE', label: 'Disponível' },
  { value: 'IN_USE', label: 'Em uso' },
  { value: 'MAINTENANCE', label: 'Manutenção' },
  { value: 'INACTIVE', label: 'Inativo' },
];

export function VehiclesListPage() {
  const [rows, setRows] = useState<
    (VehicleDto & {
      routeTodayId?: string | null;
      routeTodayStatus?: string | null;
      driverName?: string | null;
    })[]
  >([]);
  const [summary, setSummary] = useState<VehiclesSummary | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(search = q) {
    setLoading(true);
    try {
      const qs = search ? `?q=${encodeURIComponent(search)}` : '';
      const [listRes, summaryRes] = await Promise.all([
        apiFetch<{
          vehicles: (VehicleDto & {
            routeTodayId: string | null;
            routeTodayStatus: string | null;
            driverName: string | null;
          })[];
        }>(`/api/v1/ops/vehicles/list-enriched${qs}`),
        apiFetch<VehiclesSummary>('/api/v1/ops/vehicles/summary').catch(() => null),
      ]);
      setRows(listRes.vehicles);
      setSummary(summaryRes);
      setSummaryError(summaryRes ? null : 'KPIs indisponíveis');
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha de rede');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Veículos"
        action={
          <Link href="/vehicles/new" className="ops-btn ops-btn-primary">
            Novo
          </Link>
        }
      />
      <OperationalSummaryStrip
        loading={loading && !summary}
        error={summaryError}
        items={
          summary
            ? [
                { label: 'Total', value: summary.total },
                { label: 'Disponíveis', value: summary.available },
                { label: 'Em uso', value: summary.inUse },
                { label: 'Manutenção', value: summary.maintenance },
                { label: 'Rotas hoje', value: summary.routesToday },
                { label: 'Km plan.', value: summaryKm(summary.plannedDistanceMeters) },
                { label: 'GPS live', value: summary.liveTrackingCount },
              ]
            : []
        }
      />
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Placa ou modelo" className="flex-1 ops-input text-sm" />
        <button type="submit" className="ops-btn ops-btn-secondary">
          Buscar
        </button>
      </form>
      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <DataTable
          empty="Nenhum veículo cadastrado. Cadastre a frota para publicar rotas."
          columns={[
            { key: 'plate', label: 'Placa' },
            { key: 'model', label: 'Modelo' },
            { key: 'status', label: 'Status' },
            { key: 'route', label: 'Rota hoje' },
            { key: 'driver', label: 'Motorista' },
            { key: 'actions', label: '' },
          ]}
          rows={rows.map((v) => ({
            plate: v.plate,
            model: [v.brand, v.model].filter(Boolean).join(' ') || '—',
            status: v.status,
            route: v.routeTodayStatus ?? '—',
            driver: v.driverName ?? '—',
            actions: (
              <Link href={`/vehicles/${v.id}`} className="ops-link">
                Editar
              </Link>
            ),
          }))}
        />
      )}
    </div>
  );
}

function VehicleForm({
  initial,
  onSave,
}: {
  initial?: Partial<VehicleDto>;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    plate: initial?.plate || '',
    brand: initial?.brand || '',
    model: initial?.model || '',
    year: initial?.year != null ? String(initial.year) : '',
    fuelType: initial?.fuelType || '',
    avgConsumption: initial?.avgConsumption != null ? String(initial.avgConsumption) : '',
    capacity: initial?.capacity != null ? String(initial.capacity) : '',
    odometerKm: initial?.odometerKm != null ? String(initial.odometerKm) : '',
    status: initial?.status || 'AVAILABLE',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSave({
        plate: form.plate.trim().toUpperCase(),
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        year: form.year.trim() ? Number(form.year) : null,
        fuelType: form.fuelType.trim() || null,
        avgConsumption: form.avgConsumption.trim() ? Number(form.avgConsumption) : null,
        capacity: form.capacity.trim() ? Number(form.capacity) : null,
        odometerKm: form.odometerKm.trim() ? Number(form.odometerKm) : null,
        status: form.status,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha de rede');
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormCard error={error} onSubmit={onSubmit} loading={loading} submitLabel="Salvar">
      <FormSection title="Identificação">
        <FieldGrid>
          <TextField
            field={{
              name: 'plate',
              label: 'Placa',
              required: true,
              value: form.plate,
              onChange: (v) => setForm({ ...form, plate: v }),
            }}
          />
          <TextField
            field={{
              name: 'year',
              label: 'Ano',
              value: form.year,
              onChange: (v) => setForm({ ...form, year: v }),
            }}
          />
          <TextField
            field={{
              name: 'brand',
              label: 'Marca',
              value: form.brand,
              onChange: (v) => setForm({ ...form, brand: v }),
            }}
          />
          <TextField
            field={{
              name: 'model',
              label: 'Modelo',
              value: form.model,
              onChange: (v) => setForm({ ...form, model: v }),
            }}
          />
        </FieldGrid>
      </FormSection>
      <FormSection title="Especificações">
        <FieldGrid>
          <TextField
            field={{
              name: 'fuelType',
              label: 'Combustível',
              value: form.fuelType,
              onChange: (v) => setForm({ ...form, fuelType: v }),
            }}
          />
          <TextField
            field={{
              name: 'avgConsumption',
              label: 'Consumo médio (km/L)',
              value: form.avgConsumption,
              onChange: (v) => setForm({ ...form, avgConsumption: v }),
            }}
          />
          <TextField
            field={{
              name: 'capacity',
              label: 'Capacidade',
              value: form.capacity,
              onChange: (v) => setForm({ ...form, capacity: v }),
            }}
          />
          <TextField
            field={{
              name: 'odometerKm',
              label: 'Odômetro (km)',
              value: form.odometerKm,
              onChange: (v) => setForm({ ...form, odometerKm: v }),
            }}
          />
        </FieldGrid>
      </FormSection>
      <FormSection title="Situação">
        <SelectField
          name="status"
          label="Status"
          value={form.status}
          onChange={(v) => setForm({ ...form, status: v })}
          options={statusOpts}
        />
      </FormSection>
    </FormCard>
  );
}

export function NewVehiclePage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="Novo veículo" />
      <VehicleForm
        onSave={async (body) => {
          const r = await apiFetch<{ vehicle: { id: string } }>('/api/v1/vehicles', {
            method: 'POST',
            body: JSON.stringify(body),
          });
          router.replace(`/vehicles/${r.vehicle.id}`);
        }}
      />
    </div>
  );
}

export function EditVehiclePage({ id }: { id: string }) {
  const [data, setData] = useState<VehicleDto | null>(null);
  const [context, setContext] = useState<{ vehicle: EntityContextCard } | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ vehicle: VehicleDto }>(`/api/v1/vehicles/${id}`)
      .then((r) => setData(r.vehicle))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha'));
  }, [id]);

  useEffect(() => {
    setCtxLoading(true);
    apiFetch<{ vehicle: EntityContextCard }>(`/api/v1/ops/vehicles/${id}`)
      .then((r) => {
        setContext(r);
        setCtxError(null);
      })
      .catch((e) => setCtxError(e instanceof ApiError ? e.message : 'Contexto indisponível'))
      .finally(() => setCtxLoading(false));
  }, [id]);

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;

  const card = context?.vehicle;
  const rel = card?.relacionamentos as {
    routeToday?: { status: string } | null;
    driverToday?: { name: string } | null;
  };

  return (
    <div>
      <PageHeader title="Editar veículo" />
      <EntityContextPanel
        title={data.plate}
        statusLabel={card?.statusAtual ?? data.status}
        loading={ctxLoading}
        error={ctxError}
        metrics={
          card
            ? [
                {
                  label: 'Paradas hoje',
                  value:
                    card.metrics.stopsToday != null ? String(card.metrics.stopsToday) : '—',
                },
                {
                  label: 'Km plan.',
                  value: formatMetersKm(card.metrics.plannedDistanceMeters),
                },
                {
                  label: 'Km real',
                  value: formatMetersKm(card.metrics.actualDistanceMeters),
                },
                {
                  label: 'GPS live',
                  value: card.metrics.liveTracking ? 'Sim' : '—',
                },
              ]
            : []
        }
        relacionamentos={[
          {
            label: 'Rota hoje',
            value: rel?.routeToday?.status ?? '—',
            href: rel?.routeToday ? '/routes' : undefined,
          },
          { label: 'Motorista', value: rel?.driverToday?.name ?? '—' },
        ]}
        timeline={card?.timeline ?? []}
        acoes={card?.acoes ?? []}
      />
      {msg ? <p className="mb-3 text-sm text-[var(--ok)]">{msg}</p> : null}
      <VehicleForm
        initial={data}
        onSave={async (body) => {
          await apiFetch(`/api/v1/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
          setMsg('Salvo.');
        }}
      />
    </div>
  );
}
