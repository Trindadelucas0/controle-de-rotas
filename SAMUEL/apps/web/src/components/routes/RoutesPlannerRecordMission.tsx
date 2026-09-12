'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { toDateInputValue } from '@/lib/ops-labels';
import { ActionButton } from '@/components/ui/ActionButton';

type EmployeeOption = { id: string; name: string; status?: string; userId?: string | null };
type VehicleOption = { id: string; plate: string; status?: string };

type Props = {
  companyName: string;
};

export function RoutesPlannerRecordMission({ companyName }: Props) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [routeDate, setRouteDate] = useState(() => toDateInputValue());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, v] = await Promise.all([
        apiFetch<{ employees: EmployeeOption[] }>('/api/v1/employees?status=ACTIVE'),
        apiFetch<{ vehicles: VehicleOption[] }>('/api/v1/vehicles'),
      ]);
      setEmployees(
        e.employees.filter((x) => (!x.status || x.status === 'ACTIVE') && Boolean(x.userId)),
      );
      setVehicles(
        v.vehicles.filter((x) => !x.status || x.status === 'AVAILABLE' || x.status === 'IN_USE'),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar funcionários/veículos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish() {
    if (!employeeId || !vehicleId || publishing) return;
    setPublishing(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch('/api/v1/routes/dispatch-record-mission', {
        method: 'POST',
        body: JSON.stringify({
          date: routeDate,
          employeeId,
          vehicleId,
        }),
      });
      setMsg('Missão de gravar publicada. O funcionário vê em Minha rota.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao publicar missão');
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div className="ops-surface space-y-4 rounded-[10px] p-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-900">Encaminhar gravação</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          O funcionário grava o caminho desde o GPS dele e marca um ponto (.) em cada fazenda
          nova. Encerra a rota quando quiser. Origem da sessão: pin de {companyName}.
        </p>
      </div>

      {error ? (
        <p className="rounded-[8px] bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-[8px] bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{msg}</p>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-900">Data</span>
        <input
          type="date"
          value={routeDate}
          onChange={(e) => setRouteDate(e.target.value)}
          className="w-full ops-input text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-900">Funcionário</span>
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="w-full ops-input text-sm"
        >
          <option value="">Selecione…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-900">Veículo</span>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="w-full ops-input text-sm"
        >
          <option value="">Selecione…</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate}
            </option>
          ))}
        </select>
      </label>

      <ActionButton
        type="button"
        loading={publishing}
        disabled={!employeeId || !vehicleId}
        onClick={() => void publish()}
      >
        Publicar missão de gravar
      </ActionButton>
    </div>
  );
}
