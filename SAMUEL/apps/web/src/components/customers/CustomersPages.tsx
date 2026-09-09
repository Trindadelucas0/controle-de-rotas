'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { DataTable, FieldGrid, FormCard, FormSection, PageHeader, SelectField, TextField } from '@/components/ui/crud';
import { CustomerLocationMap } from '@/components/customers/CustomerLocationMap';
import {
  OperationalSummaryStrip,
} from '@/components/ops/OperationalSummaryStrip';
import { EntityContextPanel } from '@/components/ops/EntityContextPanel';
import { formatOpsDate, type CustomerOpsContext, type CustomersSummary } from '@/lib/ops-types';

export type CustomerDto = {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  locationStatus: string;
  category: string | null;
  priority: string | null;
  notes: string | null;
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

type LookupHint = 'idle' | 'loading' | 'ok' | 'not_found' | 'error' | 'rate_limit';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function buildAddressQuery(parts: {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}): string {
  return [parts.street, parts.number, parts.district, parts.city, parts.state, parts.zipCode, 'Brasil']
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ');
}

export function CustomersListPage() {
  const [rows, setRows] = useState<
    (CustomerDto & {
      openServiceOrders?: number;
      nextVisitAt?: string | null;
      nextVisitEmployeeName?: string | null;
    })[]
  >([]);
  const [summary, setSummary] = useState<CustomersSummary | null>(null);
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
          customers: (CustomerDto & {
            openServiceOrders: number;
            nextVisitAt: string | null;
            nextVisitEmployeeName: string | null;
          })[];
        }>(`/api/v1/ops/customers/list-enriched${qs}`),
        apiFetch<CustomersSummary>('/api/v1/ops/customers/summary').catch(() => null),
      ]);
      setRows(listRes.customers);
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
        title="Clientes"
        action={
          <Link href="/customers/new" className="ops-btn ops-btn-primary">
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
                { label: 'Ativos', value: summary.active },
                { label: 'Com pin', value: summary.withLocation },
                { label: 'Visita hoje', value: summary.withVisitToday },
                { label: 'OS abertas', value: summary.withOpenOs },
                { label: 'Sem visita 30d', value: summary.withoutVisit30d },
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
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome, documento…"
          className="flex-1 ops-input text-sm"
        />
        <button type="submit" className="ops-btn ops-btn-secondary">
          Buscar
        </button>
      </form>
      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <DataTable
          empty="Nenhum cliente cadastrado. Cadastre o primeiro para usar no mapa e nas ordens."
          columns={[
            { key: 'name', label: 'Nome' },
            { key: 'document', label: 'Documento' },
            { key: 'city', label: 'Cidade' },
            { key: 'openOs', label: 'OS abertas' },
            { key: 'nextVisit', label: 'Próxima visita' },
            { key: 'locationStatus', label: 'Localização' },
            { key: 'status', label: 'Status' },
            { key: 'actions', label: '' },
          ]}
          rows={rows.map((c) => ({
            name: c.name,
            document: c.document || '—',
            city: c.city || '—',
            openOs: c.openServiceOrders ?? '—',
            nextVisit: c.nextVisitAt
              ? `${formatOpsDate(c.nextVisitAt)}${c.nextVisitEmployeeName ? ` · ${c.nextVisitEmployeeName}` : ''}`
              : '—',
            locationStatus: c.locationStatus,
            status: c.status,
            actions: (
              <Link href={`/customers/${c.id}`} className="ops-link">
                Abrir
              </Link>
            ),
          }))}
        />
      )}
    </div>
  );
}

function hintMessage(kind: 'cnpj' | 'cep' | 'address', hint: LookupHint): string | null {
  if (hint === 'loading') {
    if (kind === 'cnpj') return 'Buscando CNPJ…';
    if (kind === 'cep') return 'Buscando CEP…';
    return 'Buscando endereço…';
  }
  if (hint === 'ok') {
    if (kind === 'cnpj') return 'CNPJ aplicado.';
    if (kind === 'cep') return 'CEP aplicado.';
    return null;
  }
  if (hint === 'not_found') {
    if (kind === 'cnpj') return 'CNPJ não encontrado.';
    if (kind === 'cep') return 'CEP não encontrado.';
    return 'Nenhuma sugestão de endereço.';
  }
  if (hint === 'rate_limit') return 'Muitas consultas. Aguarde e tente de novo.';
  if (hint === 'error') return 'Falha na consulta. Tente de novo.';
  return null;
}

function CustomerForm({
  initial,
  onSave,
}: {
  initial?: Partial<CustomerDto>;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    tradeName: initial?.tradeName || '',
    document: initial?.document || '',
    phone: initial?.phone || '',
    whatsapp: initial?.whatsapp || '',
    email: initial?.email || '',
    street: initial?.street || '',
    number: initial?.number || '',
    complement: initial?.complement || '',
    district: initial?.district || '',
    city: initial?.city || '',
    state: initial?.state || '',
    zipCode: initial?.zipCode || '',
    category: initial?.category || '',
    priority: initial?.priority || 'normal',
    notes: initial?.notes || '',
    status: initial?.status || 'ACTIVE',
  });
  const [latitude, setLatitude] = useState<number | null>(initial?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initial?.longitude ?? null);
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [cnpjHint, setCnpjHint] = useState<LookupHint>('idle');
  const [cepHint, setCepHint] = useState<LookupHint>('idle');
  const [addressHint, setAddressHint] = useState<LookupHint>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appliedCnpj = useRef<string | null>(
    initial?.document && digitsOnly(initial.document).length === 14
      ? digitsOnly(initial.document)
      : null,
  );
  const appliedCep = useRef<string | null>(
    initial?.zipCode && digitsOnly(initial.zipCode).length === 8
      ? digitsOnly(initial.zipCode)
      : null,
  );
  const cnpjAbort = useRef<AbortController | null>(null);
  const cepAbort = useRef<AbortController | null>(null);
  const addressAbort = useRef<AbortController | null>(null);
  const geocodeAbort = useRef<AbortController | null>(null);

  const setPin = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  const pullPinFromAddress = useCallback(
    async (parts: {
      street?: string;
      number?: string;
      district?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    }) => {
      const q = buildAddressQuery(parts);
      if (q.replace(', Brasil', '').trim().length < 5) return;

      geocodeAbort.current?.abort();
      const controller = new AbortController();
      geocodeAbort.current = controller;
      try {
        const r = await apiFetch<{ suggestions: AddressSuggestion[] }>(
          `/api/v1/lookups/address?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        const first = r.suggestions[0];
        if (first) setPin(first.latitude, first.longitude);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        // pin opcional neste passo; usuário ainda pode clicar no mapa
      }
    },
    [setPin],
  );

  useEffect(() => {
    const cnpj = digitsOnly(form.document);
    if (cnpj.length !== 14) {
      if (cnpjHint === 'loading') setCnpjHint('idle');
      return;
    }
    if (appliedCnpj.current === cnpj) return;

    const timer = setTimeout(async () => {
      cnpjAbort.current?.abort();
      const controller = new AbortController();
      cnpjAbort.current = controller;
      setCnpjHint('loading');
      try {
        const r = await apiFetch<{
          company: {
            name: string;
            tradeName: string | null;
            phone: string | null;
            email: string | null;
            street: string | null;
            number: string | null;
            complement: string | null;
            district: string | null;
            city: string | null;
            state: string | null;
            zipCode: string | null;
          };
        }>(`/api/v1/lookups/cnpj/${cnpj}`, { signal: controller.signal });

        appliedCnpj.current = cnpj;
        const c = r.company;
        setForm((prev) => ({
          ...prev,
          name: c.name || prev.name,
          tradeName: c.tradeName || prev.tradeName,
          phone: c.phone || prev.phone,
          email: c.email || prev.email,
          street: c.street || prev.street,
          number: c.number || prev.number,
          complement: c.complement || prev.complement,
          district: c.district || prev.district,
          city: c.city || prev.city,
          state: c.state || prev.state,
          zipCode: c.zipCode || prev.zipCode,
        }));
        setCnpjHint('ok');
        await pullPinFromAddress({
          street: c.street || undefined,
          number: c.number || undefined,
          district: c.district || undefined,
          city: c.city || undefined,
          state: c.state || undefined,
          zipCode: c.zipCode || undefined,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (e instanceof ApiError) {
          if (e.status === 404) setCnpjHint('not_found');
          else if (e.status === 429) setCnpjHint('rate_limit');
          else setCnpjHint('error');
          return;
        }
        setCnpjHint('error');
      }
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.document, pullPinFromAddress]);

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
        setForm((prev) => ({
          ...prev,
          street: a.street || prev.street,
          district: a.district || prev.district,
          city: a.city || prev.city,
          state: a.state || prev.state,
          zipCode: a.zipCode,
        }));
        setCepHint('ok');

        if (a.latitude != null && a.longitude != null) {
          setPin(a.latitude, a.longitude);
        } else {
          await pullPinFromAddress({
            street: a.street || undefined,
            district: a.district || undefined,
            city: a.city || undefined,
            state: a.state || undefined,
            zipCode: a.zipCode,
            number: form.number || undefined,
          });
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
  }, [form.zipCode, pullPinFromAddress, setPin]);

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
      street: s.street || prev.street,
      number: s.number || prev.number,
      district: s.district || prev.district,
      city: s.city || prev.city,
      state: s.state || prev.state,
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
    if (latitude == null || longitude == null) {
      setError('Marque o local no mapa (clique) ou preencha CEP/endereço para posicionar o pin.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave({
        name: form.name.trim(),
        tradeName: form.tradeName.trim() || null,
        document: form.document.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        street: form.street.trim() || null,
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        district: form.district.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zipCode: form.zipCode.trim() || null,
        latitude,
        longitude,
        category: form.category.trim() || null,
        priority: form.priority.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha de rede');
    } finally {
      setLoading(false);
    }
  }

  const cnpjMsg = hintMessage('cnpj', cnpjHint);
  const cepMsg = hintMessage('cep', cepHint);
  const addressMsg = hintMessage('address', addressHint);

  return (
    <FormCard error={error} onSubmit={onSubmit} loading={loading} submitLabel="Salvar">
      <FormSection title="Identificação">
        <FieldGrid>
          <TextField
            field={{
              name: 'name',
              label: 'Nome / razão social',
              required: true,
              value: form.name,
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
          <div className="sm:col-span-2">
            <TextField
              field={{
                name: 'document',
                label: 'CPF/CNPJ',
                value: form.document,
                onChange: (v) => {
                  appliedCnpj.current = null;
                  setForm({ ...form, document: v });
                },
                placeholder: 'CNPJ com 14 dígitos preenche automaticamente',
              }}
            />
            {cnpjMsg ? (
              <p className={`mt-1 text-xs ${cnpjHint === 'ok' ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}`}>
                {cnpjMsg}
              </p>
            ) : null}
          </div>
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
              name: 'whatsapp',
              label: 'WhatsApp',
              value: form.whatsapp,
              onChange: (v) => setForm({ ...form, whatsapp: v }),
            }}
          />
          <div className="sm:col-span-2">
            <TextField
              field={{
                name: 'email',
                label: 'E-mail',
                type: 'email',
                value: form.email,
                onChange: (v) => setForm({ ...form, email: v }),
              }}
            />
          </div>
        </FieldGrid>
      </FormSection>

      <FormSection title="Endereço" hint="CEP e busca preenchem rua, cidade e pin quando possível.">
        <div className="relative">
          <label className="block text-sm">
            <span className="ops-label">Buscar endereço</span>
            <input
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              placeholder="Rua, número, cidade…"
              className="ops-input"
              autoComplete="off"
            />
          </label>
          {addressMsg && addressHint !== 'ok' ? (
            <p className="mt-1 text-xs text-[var(--warn)]">{addressMsg}</p>
          ) : null}
          {suggestions.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-[6px] border border-[var(--border)] bg-surface">
              {suggestions.map((s) => (
                <li key={`${s.label}-${s.latitude}-${s.longitude}`}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-white/[0.04]"
                    onClick={() => applySuggestion(s)}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <FieldGrid>
          <div>
            <TextField
              field={{
                name: 'zipCode',
                label: 'CEP (opcional)',
                value: form.zipCode,
                onChange: (v) => {
                  appliedCep.current = null;
                  setForm({ ...form, zipCode: v });
                },
                placeholder: '8 dígitos — fazendas podem deixar em branco',
              }}
            />
            {cepMsg ? (
              <p className={`mt-1 text-xs ${cepHint === 'ok' ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}`}>
                {cepMsg}
              </p>
            ) : null}
          </div>
          <TextField
            field={{
              name: 'street',
              label: 'Rua',
              value: form.street,
              onChange: (v) => setForm({ ...form, street: v }),
            }}
          />
          <TextField
            field={{
              name: 'number',
              label: 'Número',
              value: form.number,
              onChange: (v) => setForm({ ...form, number: v }),
            }}
          />
          <TextField
            field={{
              name: 'complement',
              label: 'Complemento',
              value: form.complement,
              onChange: (v) => setForm({ ...form, complement: v }),
            }}
          />
          <TextField
            field={{
              name: 'district',
              label: 'Bairro',
              value: form.district,
              onChange: (v) => setForm({ ...form, district: v }),
            }}
          />
          <TextField
            field={{
              name: 'city',
              label: 'Cidade',
              value: form.city,
              onChange: (v) => setForm({ ...form, city: v }),
            }}
          />
          <TextField
            field={{
              name: 'state',
              label: 'UF',
              value: form.state,
              onChange: (v) => setForm({ ...form, state: v }),
            }}
          />
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Localização no mapa"
        hint="O pin é obrigatório para rotas. Fazendas sem CEP: clique no mapa ou informe latitude/longitude."
      >
        <FieldGrid>
          <label className="block text-sm">
            <span className="ops-label">Latitude</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={latitude ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (!v) {
                  setLatitude(null);
                  return;
                }
                const n = Number(v);
                if (!Number.isFinite(n)) return;
                setLatitude(n);
                if (longitude != null && Number.isFinite(longitude)) setPin(n, longitude);
              }}
              className="ops-input"
              aria-label="Latitude"
            />
          </label>
          <label className="block text-sm">
            <span className="ops-label">Longitude</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={longitude ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (!v) {
                  setLongitude(null);
                  return;
                }
                const n = Number(v);
                if (!Number.isFinite(n)) return;
                setLongitude(n);
                if (latitude != null && Number.isFinite(latitude)) setPin(latitude, n);
              }}
              className="ops-input"
              aria-label="Longitude"
            />
          </label>
        </FieldGrid>
        <CustomerLocationMap latitude={latitude} longitude={longitude} onPinChange={setPin} />
      </FormSection>

      <FormSection title="Classificação">
        <FieldGrid>
          <TextField
            field={{
              name: 'category',
              label: 'Categoria',
              value: form.category,
              onChange: (v) => setForm({ ...form, category: v }),
            }}
          />
          <TextField
            field={{
              name: 'priority',
              label: 'Prioridade',
              value: form.priority,
              onChange: (v) => setForm({ ...form, priority: v }),
            }}
          />
          <div className="sm:col-span-2">
            <TextField
              field={{
                name: 'notes',
                label: 'Observações',
                value: form.notes,
                onChange: (v) => setForm({ ...form, notes: v }),
              }}
            />
          </div>
          <SelectField
            name="status"
            label="Status"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={[
              { value: 'ACTIVE', label: 'Ativo' },
              { value: 'INACTIVE', label: 'Inativo' },
            ]}
          />
        </FieldGrid>
      </FormSection>
    </FormCard>
  );
}

export function NewCustomerPage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader
        title="Novo cliente"
        subtitle="CNPJ/CEP preenchem dados; marque o local no mapa ou via endereço"
      />
      <CustomerForm
        onSave={async (body) => {
          const r = await apiFetch<{ customer: { id: string } }>('/api/v1/customers', {
            method: 'POST',
            body: JSON.stringify(body),
          });
          router.replace(`/customers/${r.customer.id}`);
        }}
      />
    </div>
  );
}

export function EditCustomerPage({ id }: { id: string }) {
  const [data, setData] = useState<CustomerDto | null>(null);
  const [context, setContext] = useState<CustomerOpsContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ customer: CustomerDto }>(`/api/v1/customers/${id}`)
      .then((r) => setData(r.customer))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha'));
  }, [id]);

  useEffect(() => {
    setCtxLoading(true);
    apiFetch<CustomerOpsContext>(`/api/v1/ops/customers/${id}`)
      .then((r) => {
        setContext(r);
        setCtxError(null);
      })
      .catch((e) => setCtxError(e instanceof ApiError ? e.message : 'Contexto indisponível'))
      .finally(() => setCtxLoading(false));
  }, [id]);

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;

  const card = context?.customer;

  return (
    <div>
      <PageHeader title="Prontuário do cliente" subtitle={`Localização: ${data.locationStatus}`} />
      <EntityContextPanel
        title={data.name}
        statusLabel={card?.statusAtual ?? data.status}
        loading={ctxLoading}
        error={ctxError}
        metrics={
          card
            ? [
                { label: 'OS abertas', value: String(card.metrics.openServiceOrders) },
                { label: 'Visitas', value: String(card.metrics.visitsTotal) },
                {
                  label: 'Última visita',
                  value: formatOpsDate(card.metrics.lastVisitAt),
                },
                {
                  label: 'Próxima visita',
                  value: formatOpsDate(card.metrics.nextVisitAt),
                },
              ]
            : []
        }
        relacionamentos={
          card
            ? [
                {
                  label: 'Responsável',
                  value: card.relacionamentos.responsibleEmployee?.name ?? '—',
                  href: card.relacionamentos.responsibleEmployee
                    ? `/employees/${card.relacionamentos.responsibleEmployee.id}`
                    : undefined,
                },
                {
                  label: 'Rota',
                  value: card.relacionamentos.routeId ? 'Ver rotas' : '—',
                  href: card.relacionamentos.routeId ? '/routes' : undefined,
                },
              ]
            : []
        }
        timeline={card?.timeline ?? []}
        acoes={card?.acoes ?? []}
      />
      {msg ? <p className="mb-3 text-sm text-[var(--ok)]">{msg}</p> : null}
      <CustomerForm
        initial={data}
        onSave={async (body) => {
          await apiFetch(`/api/v1/customers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
          setMsg('Salvo.');
        }}
      />
    </div>
  );
}
