'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch, apiUpload, ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/cost-metric';
import { OdometerPhotoCapture } from '@/components/field/OdometerPhotoCapture';

type VehicleOpt = { id: string; plate: string; odometerKm?: number | null; fuelType?: string | null };

export function FieldFuelPage() {
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [receiptRequired, setReceiptRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const totalPreview = useMemo(() => {
    const l = Number(liters.replace(',', '.'));
    const p = Number(price.replace(',', '.'));
    if (!Number.isFinite(l) || !Number.isFinite(p)) return null;
    return Math.round(l * p * 100) / 100;
  }, [liters, price]);

  useEffect(() => {
    apiFetch<{ vehicles: VehicleOpt[] }>('/api/v1/field/vehicles')
      .then((r) => {
        setVehicles(r.vehicles);
        const first = r.vehicles[0];
        if (first) {
          setVehicleId(first.id);
          if (first.odometerKm != null) setOdometerKm(String(first.odometerKm));
        }
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha ao carregar veículos'));
    apiFetch<{ settings: { fuelReceiptRequired: boolean } }>('/api/v1/companies/me/cost-settings')
      .then((r) => setReceiptRequired(r.settings.fuelReceiptRequired))
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('vehicleId', vehicleId);
      form.append('occurredAt', new Date().toISOString());
      form.append('odometerKm', odometerKm.replace(',', '.'));
      form.append('liters', liters.replace(',', '.'));
      form.append('pricePerLiter', price.replace(',', '.'));
      if (photo) form.append('file', photo);
      await apiUpload('/api/v1/field/fuel-fills', form);
      setOk(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar');
    } finally {
      setSaving(false);
    }
  }

  if (ok) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-brand-900">Abastecimento registrado</h1>
        <p className="text-sm text-[var(--muted)]">O valor entra nos custos da frota como REAL.</p>
        <Link href="/field/my-route" className="ops-btn ops-btn-primary inline-flex">
          Voltar para Minha rota
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-900">Registrar abastecimento</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3 rounded-2xl border border-brand-100 bg-surface p-5">
        {error ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Veículo *</span>
          <select
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              const v = vehicles.find((x) => x.id === e.target.value);
              if (v?.odometerKm != null) setOdometerKm(String(v.odometerKm));
            }}
            className="w-full ops-input"
            required
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Odômetro (km) *</span>
          <input className="w-full ops-input" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Litros *</span>
          <input className="w-full ops-input" value={liters} onChange={(e) => setLiters(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Preço por litro *</span>
          <input className="w-full ops-input" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </label>
        <div className="rounded-[10px] border border-[var(--border)] p-3">
          <p className="text-xs text-[var(--muted)]">Total (calculado)</p>
          <p className="text-xl font-semibold">{formatMoney(totalPreview)}</p>
        </div>
        <OdometerPhotoCapture
          id="field-fuel-receipt"
          label="Comprovante"
          file={photo}
          onChange={setPhoto}
          required={receiptRequired}
        />
        <button type="submit" disabled={saving} className="ops-btn ops-btn-primary w-full">
          {saving ? 'Salvando…' : 'Registrar'}
        </button>
        <Link href="/field/my-route" className="block text-center text-sm ops-link">
          Cancelar
        </Link>
      </form>
    </section>
  );
}
