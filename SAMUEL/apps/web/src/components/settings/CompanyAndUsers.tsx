'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { FieldGrid, FormCard, FormSection, PageHeader, TextField, SelectField } from '@/components/ui/crud';
import { CustomerLocationMap } from '@/components/customers/CustomerLocationMap';

export type CompanyDto = {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationStatus: string;
  status: string;
};

type AddressSuggestion = {
  label: string;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number;
  longitude: number;
};

type LookupHint = 'idle' | 'loading' | 'ok' | 'not_found' | 'rate_limit' | 'error';

function digitsOnly(v: string) {
  return v.replace(/\D/g, '');
}

function hintMessage(kind: 'cep' | 'address', hint: LookupHint): string | null {
  if (hint === 'loading') return kind === 'cep' ? 'Consultando CEP…' : 'Buscando endereço…';
  if (hint === 'not_found') return kind === 'cep' ? 'CEP não encontrado.' : 'Nenhum endereço encontrado.';
  if (hint === 'rate_limit') return 'Muitas consultas. Aguarde um momento.';
  if (hint === 'error') return 'Falha na consulta. Tente de novo.';
  return null;
}

export function CompanySettingsPage() {
  const [form, setForm] = useState({
    name: '',
    tradeName: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    zipCode: '',
    status: 'ACTIVE',
  });
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [cepHint, setCepHint] = useState<LookupHint>('idle');
  const [addressHint, setAddressHint] = useState<LookupHint>('idle');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const appliedCep = useRef<string | null>(null);
  const cepAbort = useRef<AbortController | null>(null);
  const addressAbort = useRef<AbortController | null>(null);

  const setPin = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  useEffect(() => {
    apiFetch<{ company: CompanyDto }>('/api/v1/companies/me')
      .then((r) => {
        const c = r.company;
        setForm({
          name: c.name || '',
          tradeName: c.tradeName || '',
          document: c.document || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          zipCode: '',
          status: c.status || 'ACTIVE',
        });
        setLatitude(c.latitude ?? null);
        setLongitude(c.longitude ?? null);
        if (c.address) setAddressQuery(c.address);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const cep = digitsOnly(form.zipCode);
    if (cep.length !== 8) {
      if (cepHint === 'loading') setCepHint('idle');
      return;
    }
    if (appliedCep.current === cep) return;

    const timer = setTimeout(async () => {
      cepAbort.current?.abort();
      const controller = new AbortController();
      cepAbort.current = controller;
      setCepHint('loading');
      try {
        const r = await apiFetch<{
          address: {
            street: string | null;
            district: string | null;
            city: string | null;
            state: string | null;
            zipCode: string;
            latitude: number | null;
            longitude: number | null;
          };
        }>(`/api/v1/lookups/cep/${cep}`, { signal: controller.signal });

        appliedCep.current = cep;
        const a = r.address;
        const parts = [a.street, a.district, a.city, a.state, a.zipCode].filter(Boolean);
        const label = parts.join(', ');
        setForm((prev) => ({
          ...prev,
          zipCode: a.zipCode,
          address: label || prev.address,
        }));
        if (label) setAddressQuery(label);
        setCepHint('ok');

        if (a.latitude != null && a.longitude != null) {
          setPin(a.latitude, a.longitude);
        } else if (label) {
          try {
            const geo = await apiFetch<{ suggestions: AddressSuggestion[] }>(
              `/api/v1/lookups/address?q=${encodeURIComponent(`${label}, Brasil`)}`,
              { signal: controller.signal },
            );
            const first = geo.suggestions[0];
            if (first) setPin(first.latitude, first.longitude);
          } catch {
            // pin opcional
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (e instanceof ApiError) {
          if (e.status === 404) setCepHint('not_found');
          else if (e.status === 429) setCepHint('rate_limit');
          else setCepHint('error');
          return;
        }
        setCepHint('error');
      }
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.zipCode, setPin]);

  useEffect(() => {
    const q = addressQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      if (addressHint === 'loading') setAddressHint('idle');
      return;
    }

    const timer = setTimeout(async () => {
      addressAbort.current?.abort();
      const controller = new AbortController();
      addressAbort.current = controller;
      setAddressHint('loading');
      try {
        const r = await apiFetch<{ suggestions: AddressSuggestion[] }>(
          `/api/v1/lookups/address?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        setSuggestions(r.suggestions);
        setAddressHint(r.suggestions.length ? 'ok' : 'not_found');
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setSuggestions([]);
        if (e instanceof ApiError && e.status === 429) setAddressHint('rate_limit');
        else setAddressHint('error');
      }
    }, 450);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressQuery]);

  function applySuggestion(s: AddressSuggestion) {
    setForm((prev) => ({
      ...prev,
      address: s.label,
      zipCode: s.zipCode || prev.zipCode,
    }));
    if (s.zipCode) appliedCep.current = digitsOnly(s.zipCode);
    setPin(s.latitude, s.longitude);
    setAddressQuery(s.label);
    setSuggestions([]);
    setAddressHint('ok');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      await apiFetch('/api/v1/companies/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          tradeName: form.tradeName.trim() || null,
          document: form.document.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: (form.address.trim() || addressQuery.trim()) || null,
          latitude,
          longitude,
          status: form.status,
        }),
      });
      setOk(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha de rede');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;

  const cepMsg = hintMessage('cep', cepHint);
  const addressMsg = hintMessage('address', addressHint);

  return (
    <div>
      <PageHeader
        title="Empresa"
        subtitle="Dados cadastrais e origem no mapa para cálculo de rotas"
      />
      {ok ? <p className="mb-4 text-sm text-[var(--ok)]">Salvo com sucesso.</p> : null}
      <FormCard error={error} onSubmit={onSubmit} loading={saving} submitLabel="Salvar">
        <FormSection title="Identificação">
          <FieldGrid>
            <TextField
              field={{
                name: 'name',
                label: 'Razão social / Nome',
                value: form.name,
                required: true,
                onChange: (v) => setForm({ ...form, name: v }),
              }}
            />
            <TextField
              field={{
                name: 'tradeName',
                label: 'Nome fantasia',
                value: form.tradeName,
                onChange: (v) => setForm({ ...form, tradeName: v }),
              }}
            />
            <TextField
              field={{
                name: 'document',
                label: 'CNPJ',
                value: form.document,
                onChange: (v) => setForm({ ...form, document: v }),
              }}
            />
          </FieldGrid>
        </FormSection>
        <FormSection title="Contato">
          <FieldGrid>
            <TextField
              field={{
                name: 'phone',
                label: 'Telefone',
                value: form.phone,
                onChange: (v) => setForm({ ...form, phone: v }),
              }}
            />
            <TextField
              field={{
                name: 'email',
                label: 'E-mail',
                type: 'email',
                value: form.email,
                onChange: (v) => setForm({ ...form, email: v }),
              }}
            />
          </FieldGrid>
        </FormSection>
        <FormSection title="Origem para rotas" hint="O pin da empresa é o ponto E das rotas.">
          <TextField
            field={{
              name: 'zipCode',
              label: 'CEP',
              value: form.zipCode,
              onChange: (v) => setForm({ ...form, zipCode: v }),
            }}
          />
          {cepMsg && cepHint !== 'ok' ? <p className="text-xs text-[var(--warn)]">{cepMsg}</p> : null}
          <div>
            <label htmlFor="company-address-search" className="ops-label">
              Buscar endereço
            </label>
            <input
              id="company-address-search"
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              placeholder="Rua, bairro, cidade…"
              className="ops-input"
              autoComplete="off"
            />
            {addressMsg && addressHint !== 'ok' ? (
              <p className="mt-1 text-xs text-[var(--warn)]">{addressMsg}</p>
            ) : null}
            {suggestions.length > 0 ? (
              <ul className="mt-1 max-h-40 overflow-auto rounded-[6px] border border-[var(--border)] bg-surface text-sm">
                {suggestions.map((s) => (
                  <li key={`${s.label}-${s.latitude}-${s.longitude}`}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-white/[0.04]"
                      onClick={() => applySuggestion(s)}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <TextField
            field={{
              name: 'address',
              label: 'Endereço (texto)',
              value: form.address,
              onChange: (v) => setForm({ ...form, address: v }),
            }}
          />
          <CustomerLocationMap
            latitude={latitude}
            longitude={longitude}
            onPinChange={setPin}
            required={false}
            title="Origem no mapa (rotas)"
            pinLabel="Pin da empresa"
          />
        </FormSection>
        <FormSection title="Situação">
          <SelectField
            name="status"
            label="Status"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={[
              { value: 'ACTIVE', label: 'Ativa' },
              { value: 'INACTIVE', label: 'Inativa' },
            ]}
          />
        </FormSection>
      </FormCard>
    </div>
  );
}
