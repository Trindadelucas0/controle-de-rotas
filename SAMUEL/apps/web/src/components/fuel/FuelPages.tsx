'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Fuel, Plus } from 'lucide-react';
import { apiFetch, apiUpload, ApiError } from '@/lib/api-client';
import { formatMoney, formatQty } from '@/lib/cost-metric';
import { DataTable, FieldGrid, FormCard, PageHeader, SelectField, TextField } from '@/components/ui/crud';
import { OdometerPhotoCapture } from '@/components/field/OdometerPhotoCapture';

const PAYMENT: { value: string; label: string }[] = [
  { value: 'FUEL_CARD', label: 'Cartão combustível' },
  { value: 'COMPANY_CARD', label: 'Cartão da empresa' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'PIX', label: 'Pix' },
  { value: 'OTHER', label: 'Outro' },
];

type FillRow = {
  id: string;
  occurredAt: string;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType: string | null;
  station: string | null;
  status: string;
  vehicle: { id: string; plate: string };
  createdBy: { name: string };
  evidence: { id: string }[];
};

type VehicleOpt = { id: string; plate: string; fuelType?: string | null; odometerKm?: number | null };

export function FuelListPage() {
  const [rows, setRows] = useState<FillRow[]>([]);
  const [total, setTotal] = useState(0);
  const [periodTotal, setPeriodTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [q, setQ] = useState('');
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);

  useEffect(() => {
    apiFetch<{ vehicles: VehicleOpt[] }>('/api/v1/vehicles')
      .then((r) => setVehicles(r.vehicles))
      .catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '20');
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (vehicleId) params.set('vehicleId', vehicleId);
    if (q.trim()) params.set('q', q.trim());
    setLoading(true);
    apiFetch<{ fills: FillRow[]; total: number; periodTotal: number }>(
      `/api/v1/fuel-fills?${params.toString()}`,
    )
      .then((r) => {
        setRows(r.fills);
        setTotal(r.total);
        setPeriodTotal(r.periodTotal);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha ao carregar'))
      .finally(() => setLoading(false));
  }, [page, from, to, vehicleId, q]);

  return (
    <div>
      <PageHeader
        title="Abastecimentos"
        subtitle="Gasto real de combustível. O total do período soma só registros ativos."
        icon={<Fuel />}
        action={
          <Link href="/fuel/new" className="ops-btn ops-btn-primary">
            + Novo abastecimento
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} className="ops-input text-sm" />
        <input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} className="ops-input text-sm" />
        <select
          value={vehicleId}
          onChange={(e) => { setPage(1); setVehicleId(e.target.value); }}
          className="ops-input text-sm"
        >
          <option value="">Todos os veículos</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate}
            </option>
          ))}
        </select>
        <input
          placeholder="Busca placa, posto…"
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
          className="ops-input text-sm"
        />
      </div>
      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <DataTable
          columns={[
            { key: 'date', label: 'Data' },
            { key: 'vehicle', label: 'Veículo' },
            { key: 'km', label: 'Km' },
            { key: 'liters', label: 'Litros' },
            { key: 'price', label: 'R$/L' },
            { key: 'total', label: 'Total' },
            { key: 'actions', label: '' },
          ]}
          empty="Nenhum abastecimento no período."
          rows={rows.map((r) => ({
            date: new Date(r.occurredAt).toLocaleString('pt-BR'),
            vehicle: r.vehicle.plate,
            km: formatQty(r.odometerKm, 1),
            liters: formatQty(r.liters, 3),
            price: formatMoney(r.pricePerLiter),
            total: `${formatMoney(r.totalCost)}${r.status === 'CANCELLED' ? ' (cancelado)' : ''}`,
            actions: (
              <Link href={`/fuel/${r.id}`} className="ops-link text-sm">
                Ver
              </Link>
            ),
          }))}
        />
      )}
      <p className="mt-3 text-sm text-brand-900">
        Total do período (ativos): <strong>{formatMoney(periodTotal)}</strong> · {total} registro(s)
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" className="ops-btn ops-btn-secondary text-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </button>
        <button
          type="button"
          className="ops-btn ops-btn-secondary text-sm"
          disabled={page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

export function FuelNewPage() {
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [odometerKm, setOdometerKm] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('');
  const [station, setStation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('FUEL_CARD');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [receiptRequired, setReceiptRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPreview = useMemo(() => {
    const l = Number(liters.replace(',', '.'));
    const p = Number(price.replace(',', '.'));
    if (!Number.isFinite(l) || !Number.isFinite(p)) return null;
    return Math.round(l * p * 100) / 100;
  }, [liters, price]);

  useEffect(() => {
    apiFetch<{ vehicles: VehicleOpt[] }>('/api/v1/vehicles')
      .then((r) => setVehicles(r.vehicles))
      .catch(() => setVehicles([]));
    apiFetch<{ settings: { fuelReceiptRequired: boolean } }>('/api/v1/companies/me/cost-settings')
      .then((r) => setReceiptRequired(r.settings.fuelReceiptRequired))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (v?.odometerKm != null) setOdometerKm(String(v.odometerKm));
    if (v?.fuelType) setFuelType(v.fuelType);
  }, [vehicleId, vehicles]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('vehicleId', vehicleId);
      form.append('occurredAt', new Date(occurredAt).toISOString());
      form.append('odometerKm', odometerKm.replace(',', '.'));
      form.append('liters', liters.replace(',', '.'));
      form.append('pricePerLiter', price.replace(',', '.'));
      if (fuelType.trim()) form.append('fuelType', fuelType.trim());
      if (station.trim()) form.append('station', station.trim());
      form.append('paymentMethod', paymentMethod);
      if (notes.trim()) form.append('notes', notes.trim());
      if (photo) form.append('file', photo);
      const r = await apiUpload<{ fill: { id: string } }>('/api/v1/fuel-fills', form);
      window.location.href = `/fuel/${r.fill.id}`;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Abastecimento" subtitle="Registrar abastecimento do veículo" icon={<Plus />} />
      <FormCard error={error} onSubmit={onSubmit} loading={saving} submitLabel="Registrar">
        <FieldGrid>
          <SelectField
            name="vehicleId"
            label="Veículo"
            required
            value={vehicleId}
            onChange={setVehicleId}
            options={[{ value: '', label: 'Selecione…' }, ...vehicles.map((v) => ({ value: v.id, label: v.plate }))]}
          />
          <TextField
            field={{
              name: 'occurredAt',
              label: 'Data / hora',
              required: true,
              type: 'datetime-local',
              value: occurredAt,
              onChange: setOccurredAt,
            }}
          />
          <TextField
            field={{
              name: 'odometerKm',
              label: 'Odômetro (km)',
              required: true,
              value: odometerKm,
              onChange: setOdometerKm,
            }}
          />
          <TextField
            field={{
              name: 'fuelType',
              label: 'Combustível',
              value: fuelType,
              onChange: setFuelType,
            }}
          />
          <TextField
            field={{
              name: 'liters',
              label: 'Litros',
              required: true,
              value: liters,
              onChange: setLiters,
            }}
          />
          <TextField
            field={{
              name: 'price',
              label: 'Preço por litro',
              required: true,
              value: price,
              onChange: setPrice,
            }}
          />
        </FieldGrid>
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-xs text-[var(--muted)]">TOTAL DO ABASTECIMENTO (calculado)</p>
          <p className="text-2xl font-semibold text-brand-900">{formatMoney(totalPreview)}</p>
        </div>
        <TextField
          field={{ name: 'station', label: 'Posto', value: station, onChange: setStation }}
        />
        <SelectField
          name="payment"
          label="Forma de pagamento"
          value={paymentMethod}
          onChange={setPaymentMethod}
          options={PAYMENT.map((p) => ({ value: p.value, label: p.label }))}
        />
        <OdometerPhotoCapture
          id="fuel-receipt"
          label="Comprovante"
          file={photo}
          onChange={setPhoto}
          required={receiptRequired}
        />
        <TextField
          field={{ name: 'notes', label: 'Observação', value: notes, onChange: setNotes }}
        />
      </FormCard>
      <p className="mt-3">
        <Link href="/fuel" className="ops-link text-sm">
          Cancelar
        </Link>
      </p>
    </div>
  );
}

export function FuelDetailPage({ id }: { id: string }) {
  const [fill, setFill] = useState<FillRow & { notes?: string | null; paymentMethod?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ fill: FillRow }>(`/api/v1/fuel-fills/${id}`)
      .then((r) => setFill(r.fill))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha'));
  }, [id]);

  async function cancel() {
    if (!confirm('Cancelar este abastecimento? Ele sai dos totais e permanece no histórico.')) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ fill: FillRow }>(`/api/v1/fuel-fills/${id}/cancel`, { method: 'POST' });
      setFill(r.fill);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao cancelar');
    } finally {
      setBusy(false);
    }
  }

  if (!fill && !error) return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  if (!fill) return <p className="text-sm text-[var(--danger)]">{error}</p>;

  return (
    <div>
      <PageHeader title={`Abastecimento ${fill.vehicle.plate}`} icon={<Fuel />} />
      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      <dl className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-brand-100 bg-surface p-5 text-sm">
        <div>
          <dt className="text-[var(--muted)]">Data</dt>
          <dd>{new Date(fill.occurredAt).toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Km</dt>
          <dd>{formatQty(fill.odometerKm, 1)}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Litros</dt>
          <dd>{formatQty(fill.liters, 3)}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Preço/L</dt>
          <dd>{formatMoney(fill.pricePerLiter)}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Total REAL</dt>
          <dd className="text-lg font-semibold">{formatMoney(fill.totalCost)}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Posto</dt>
          <dd>{fill.station || '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Quem registrou</dt>
          <dd>{fill.createdBy.name}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Status</dt>
          <dd>{fill.status === 'CANCELLED' ? 'Cancelado' : 'Ativo'}</dd>
        </div>
      </dl>
      {fill.evidence[0] ? (
        <p className="mt-4">
          <a
            className="ops-link"
            href={`/api/v1/fuel-fills/${id}/evidence/${fill.evidence[0].id}/file`}
            target="_blank"
            rel="noreferrer"
          >
            Ver comprovante
          </a>
        </p>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">Sem comprovante.</p>
      )}
      <div className="mt-4 flex gap-2">
        <Link href="/fuel" className="ops-btn ops-btn-secondary">
          Voltar
        </Link>
        {fill.status === 'ACTIVE' ? (
          <button type="button" disabled={busy} onClick={() => void cancel()} className="ops-btn ops-btn-secondary">
            Cancelar abastecimento
          </button>
        ) : null}
      </div>
    </div>
  );
}
