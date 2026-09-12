'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useSessionUser } from '@/lib/session-context';
import { DataTable, FormCard, FormSection, PageHeader, SelectField, TextField } from '@/components/ui/crud';
import {
  OS_PRIORITY_LABELS,
  OS_STATUS_LABELS,
  VISIT_OUTCOME_LABELS,
  VISIT_STATUS_LABELS,
  fromDatetimeLocalValue,
  labelOf,
} from '@/lib/ops-labels';
import { OperationalSummaryStrip } from '@/components/ops/OperationalSummaryStrip';
import { EntityContextPanel } from '@/components/ops/EntityContextPanel';
import { formatOpsDate, type EntityContextCard, type ServiceOrdersSummary } from '@/lib/ops-types';

export type ServiceOrderListItem = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueAt: string | null;
  customerId: string;
  customer: { id: string; name: string; tradeName: string | null };
  visitsCount: number;
};

export type VisitEvidenceDto = {
  id: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  originalName: string | null;
  createdAt: string;
};

export type VisitDto = {
  id: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  status: string;
  notes: string | null;
  outcome: string | null;
  executionNotes: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  employeeId: string | null;
  employee: { id: string; name: string } | null;
  routeStop: { id: string; routeId: string; sequence: number; status?: string } | null;
  evidence?: VisitEvidenceDto[];
};

export type ServiceOrderDetail = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueAt: string | null;
  customerId: string;
  customer: {
    id: string;
    name: string;
    tradeName: string | null;
    phone: string | null;
    street: string | null;
    number: string | null;
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
    locationStatus: string;
  };
  visits: VisitDto[];
};

type CustomerOption = { id: string; name: string };
type EmployeeOption = { id: string; name: string };

const priorityOpts = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

const statusFilterOpts = [
  { value: '', label: 'Todos os status' },
  { value: 'OPEN', label: 'Aberta' },
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'COMPLETED', label: 'Concluída' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

function canManageOs(role: string | undefined) {
  return role === 'ADMIN' || role === 'PLATFORM_ADMIN' || role === 'MANAGER';
}

export function ServicesListPage() {
  const user = useSessionUser();
  const [rows, setRows] = useState<ServiceOrderListItem[]>([]);
  const [summary, setSummary] = useState<ServiceOrdersSummary | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(search = q, statusFilter = status) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString() ? `?${params}` : '';
      const [listRes, summaryRes] = await Promise.all([
        apiFetch<{ serviceOrders: ServiceOrderListItem[] }>(
          `/api/v1/service-orders${qs}`,
        ),
        apiFetch<ServiceOrdersSummary>('/api/v1/ops/service-orders/summary').catch(
          () => null,
        ),
      ]);
      setRows(listRes.serviceOrders);
      setSummary(summaryRes);
      setSummaryError(summaryRes ? null : 'KPIs indisponíveis');
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar serviços');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Ordens de serviço"
        subtitle="Serviços e visitas por cliente"
        action={
          canManageOs(user?.role) ? (
            <Link
              href="/services/new"
              className="ops-btn ops-btn-primary"
            >
              Novo
            </Link>
          ) : undefined
        }
      />
      <OperationalSummaryStrip
        loading={loading && !summary}
        error={summaryError}
        items={
          summary
            ? [
                { label: 'Total', value: summary.total },
                { label: 'Abertas', value: summary.open },
                { label: 'Em andamento', value: summary.inProgress },
                { label: 'Concluídas', value: summary.completed },
                { label: 'Canceladas', value: summary.cancelled },
              ]
            : []
        }
      />
      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Título, cliente…"
          className="flex-1 ops-input text-sm"
          aria-label="Buscar ordens de serviço"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="ops-input text-sm"
          aria-label="Filtrar status"
        >
          {statusFilterOpts.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="submit" className="ops-btn ops-btn-secondary">
          Buscar
        </button>
      </form>
      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-surface" />
      ) : (
        <DataTable
          empty="Nenhuma ordem de serviço. Crie a primeira para agendar visitas."
          columns={[
            { key: 'number', label: '#' },
            { key: 'title', label: 'Título' },
            { key: 'customer', label: 'Cliente' },
            { key: 'status', label: 'Status' },
            { key: 'priority', label: 'Prioridade' },
            { key: 'visitsCount', label: 'Visitas' },
            { key: 'actions', label: '' },
          ]}
          rows={rows.map((o) => ({
            number: o.number,
            title: o.title,
            customer: o.customer.tradeName || o.customer.name,
            status: labelOf(OS_STATUS_LABELS, o.status),
            priority: labelOf(OS_PRIORITY_LABELS, o.priority),
            visitsCount: o.visitsCount,
            actions: (
              <Link href={`/services/${o.id}`} className="ops-link">
                Abrir
              </Link>
            ),
          }))}
        />
      )}
    </div>
  );
}

export function ServiceOrderNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetCustomerId = searchParams.get('customerId') || '';
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [customerId, setCustomerId] = useState(presetCustomerId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [dueAt, setDueAt] = useState('');
  const [withFirstVisit, setWithFirstVisit] = useState(Boolean(presetCustomerId));
  const [scheduledStart, setScheduledStart] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, e] = await Promise.all([
          apiFetch<{ customers: CustomerOption[] }>('/api/v1/customers'),
          apiFetch<{ employees: EmployeeOption[] }>('/api/v1/employees'),
        ]);
        if (cancelled) return;
        setCustomers(c.customers);
        setEmployees(e.employees);
        if (presetCustomerId) setCustomerId(presetCustomerId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Falha ao carregar formulário');
        }
      } finally {
        if (!cancelled) setBoot(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [presetCustomerId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!customerId || title.trim().length < 2) {
      setError('Informe cliente e título (mín. 2 caracteres).');
      return;
    }
    if (withFirstVisit && !scheduledStart) {
      setError('Informe data/hora da primeira visita.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        customerId,
        title: title.trim(),
        priority,
      };
      if (description.trim()) body.description = description.trim();
      const dueIso = fromDatetimeLocalValue(dueAt);
      if (dueIso) body.dueAt = dueIso;
      if (withFirstVisit) {
        const startIso = fromDatetimeLocalValue(scheduledStart);
        if (!startIso) {
          setError('Data/hora da visita inválida.');
          setLoading(false);
          return;
        }
        body.firstVisit = {
          scheduledStart: startIso,
          ...(employeeId ? { employeeId } : {}),
        };
      }
      const r = await apiFetch<{ serviceOrder: ServiceOrderDetail }>('/api/v1/service-orders', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      router.push(`/services/${r.serviceOrder.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao criar ordem');
    } finally {
      setLoading(false);
    }
  }

  if (boot) {
    return <div className="h-48 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div>
      <PageHeader
        title="Nova ordem de serviço"
        action={
          <Link href="/services" className="text-sm ops-link">
            Voltar
          </Link>
        }
      />
      <FormCard error={error} onSubmit={onSubmit} loading={loading} submitLabel="Criar ordem">
        <FormSection title="Informações da ordem" hint="Cliente e o que será executado.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="customerId"
              label="Cliente"
              required
              value={customerId}
              onChange={setCustomerId}
              options={[
                { value: '', label: 'Selecione…' },
                ...customers.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <TextField
              field={{
                name: 'title',
                label: 'Título',
                required: true,
                value: title,
                onChange: setTitle,
                placeholder: 'Ex.: Manutenção preventiva',
              }}
            />
          </div>
          <label className="block text-sm sm:col-span-2">
            <span className="ops-label">Descrição</span>
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="ops-input"
            />
          </label>
        </FormSection>
        <FormSection title="Priorização e prazo">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="priority"
              label="Prioridade"
              value={priority}
              onChange={setPriority}
              options={priorityOpts}
            />
            <TextField
              field={{
                name: 'dueAt',
                label: 'Prazo',
                type: 'datetime-local',
                value: dueAt,
                onChange: setDueAt,
              }}
            />
          </div>
        </FormSection>
        <FormSection title="Execução">
          <label className="flex items-start gap-2 text-sm text-brand-900">
            <input
              type="checkbox"
              checked={withFirstVisit}
              onChange={(e) => setWithFirstVisit(e.target.checked)}
              className="mt-0.5 rounded border-brand-300"
            />
            <span>
              Agendar primeira visita
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                Cria a visita junto com a ordem. O cliente precisa ter pin.
              </span>
            </span>
          </label>
          {withFirstVisit ? (
            <div className="grid gap-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:grid-cols-2">
              <TextField
                field={{
                  name: 'scheduledStart',
                  label: 'Início agendado',
                  type: 'datetime-local',
                  required: true,
                  value: scheduledStart,
                  onChange: setScheduledStart,
                }}
              />
              <SelectField
                name="employeeId"
                label="Funcionário (opcional)"
                value={employeeId}
                onChange={setEmployeeId}
                options={[
                  { value: '', label: 'Sem atribuição' },
                  ...employees.map((e) => ({ value: e.id, label: e.name })),
                ]}
              />
            </div>
          ) : null}
        </FormSection>
      </FormCard>
    </div>
  );
}

export function ServiceOrderDetailPage({ id }: { id: string }) {
  const user = useSessionUser();
  const router = useRouter();
  const manage = canManageOs(user?.role);
  const [order, setOrder] = useState<ServiceOrderDetail | null>(null);
  const [context, setContext] = useState<{ serviceOrder: EntityContextCard } | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [visitStart, setVisitStart] = useState('');
  const [visitEmployeeId, setVisitEmployeeId] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [addingVisit, setAddingVisit] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ serviceOrder: ServiceOrderDetail }>(
        `/api/v1/service-orders/${id}`,
      );
      setOrder(r.serviceOrder);
      if (manage) {
        const e = await apiFetch<{ employees: EmployeeOption[] }>('/api/v1/employees');
        setEmployees(e.employees);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar ordem');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    setCtxLoading(true);
    apiFetch<{ serviceOrder: EntityContextCard }>(`/api/v1/ops/service-orders/${id}`)
      .then((r) => {
        setContext(r);
        setCtxError(null);
      })
      .catch((e) => setCtxError(e instanceof ApiError ? e.message : 'Contexto indisponível'))
      .finally(() => setCtxLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function cancelOrder() {
    if (!order || cancelling || !confirm(`Cancelar a OS #${order.number}?`)) return;
    setCancelling(true);
    setError(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ serviceOrder: ServiceOrderDetail }>(
        `/api/v1/service-orders/${id}/cancel`,
        { method: 'POST' },
      );
      setOrder(r.serviceOrder);
      setMsg('Ordem cancelada.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao cancelar');
    } finally {
      setCancelling(false);
    }
  }

  async function addVisit(e: React.FormEvent) {
    e.preventDefault();
    if (addingVisit) return;
    const startIso = fromDatetimeLocalValue(visitStart);
    if (!startIso) {
      setError('Informe data/hora da visita.');
      return;
    }
    setAddingVisit(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/service-orders/${id}/visits`, {
        method: 'POST',
        body: JSON.stringify({
          scheduledStart: startIso,
          ...(visitEmployeeId ? { employeeId: visitEmployeeId } : {}),
          ...(visitNotes.trim() ? { notes: visitNotes.trim() } : {}),
        }),
      });
      setVisitStart('');
      setVisitEmployeeId('');
      setVisitNotes('');
      setMsg('Visita adicionada.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao adicionar visita');
    } finally {
      setAddingVisit(false);
    }
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-surface" />;
  }

  if (!order) {
    return (
      <div>
        <PageHeader title="Ordem de serviço" />
        <p className="text-sm text-[var(--danger)]">{error || 'Ordem não encontrada.'}</p>
        <button
          type="button"
          onClick={() => router.push('/services')}
          className="mt-4 text-sm ops-link"
        >
          Voltar à lista
        </button>
      </div>
    );
  }

  const cancelled = order.status === 'CANCELLED';
  const addr = [order.customer.street, order.customer.number, order.customer.city]
    .filter(Boolean)
    .join(', ');
  const card = context?.serviceOrder;
  const rel = card?.relacionamentos as {
    customer?: { id: string; name: string };
    lastVisit?: { scheduledStart: string; status: string } | null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`OS #${order.number}`}
        subtitle={order.title}
        action={
          <Link href="/services" className="text-sm ops-link">
            Voltar
          </Link>
        }
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {msg ? <p className="text-sm text-[var(--ok)]">{msg}</p> : null}

      <EntityContextPanel
        title={`OS #${order.number} — ${order.title}`}
        statusLabel={labelOf(OS_STATUS_LABELS, order.status)}
        loading={ctxLoading}
        error={ctxError}
        metrics={
          card
            ? [
                { label: 'Visitas', value: String(card.metrics.visitsCount ?? '—') },
                {
                  label: 'Visitas abertas',
                  value: String(card.metrics.openVisits ?? '—'),
                },
                {
                  label: 'Última visita',
                  value: rel?.lastVisit
                    ? formatOpsDate(rel.lastVisit.scheduledStart)
                    : '—',
                },
              ]
            : []
        }
        relacionamentos={[
          {
            label: 'Cliente',
            value: rel?.customer?.name ?? order.customer.name,
            href: `/customers/${order.customer.id}`,
          },
        ]}
        timeline={card?.timeline ?? []}
        acoes={card?.acoes ?? []}
      />

      <section className="rounded-2xl border border-brand-100 bg-surface p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted)]">Cliente</dt>
            <dd className="font-medium text-brand-900">
              <Link href={`/customers/${order.customer.id}`} className="ops-link">
                {order.customer.tradeName || order.customer.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Status</dt>
            <dd className="font-medium text-brand-900">{labelOf(OS_STATUS_LABELS, order.status)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Prioridade</dt>
            <dd className="font-medium text-brand-900">
              {labelOf(OS_PRIORITY_LABELS, order.priority)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Prazo</dt>
            <dd className="font-medium text-brand-900">
              {order.dueAt ? new Date(order.dueAt).toLocaleString('pt-BR') : '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--muted)]">Endereço</dt>
            <dd className="font-medium text-brand-900">{addr || '—'}</dd>
          </div>
          {order.description ? (
            <div className="sm:col-span-2">
              <dt className="text-[var(--muted)]">Descrição</dt>
              <dd className="whitespace-pre-wrap text-brand-900">{order.description}</dd>
            </div>
          ) : null}
        </dl>
        {manage && !cancelled ? (
          <button
            type="button"
            disabled={cancelling}
            onClick={() => void cancelOrder()}
            className="ops-btn ops-btn-danger mt-4 disabled:opacity-60"
          >
            {cancelling ? 'Cancelando…' : 'Cancelar ordem'}
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-brand-100 bg-surface p-5">
        <h2 className="text-lg font-semibold text-brand-900">Visitas</h2>
        {order.visits.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Nenhuma visita agendada.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {order.visits.map((v) => (
              <li
                key={v.id}
                className="ops-input text-sm"
              >
                <p className="font-medium text-brand-900">
                  {new Date(v.scheduledStart).toLocaleString('pt-BR')}
                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                    {labelOf(VISIT_STATUS_LABELS, v.status)}
                  </span>
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {v.employee?.name || 'Sem funcionário'}
                  {v.routeStop ? ` · Rota seq. ${v.routeStop.sequence}` : ''}
                </p>
                {v.notes ? <p className="mt-1 text-xs text-brand-800">{v.notes}</p> : null}
                {(v.checkedInAt || v.checkedOutAt || v.outcome || v.executionNotes) && (
                  <div className="mt-2 rounded-lg bg-brand-50/80 px-2.5 py-2 text-xs text-brand-900">
                    <p className="font-semibold">Relatório de campo</p>
                    {v.outcome ? (
                      <p className="mt-1">
                        Resultado: {labelOf(VISIT_OUTCOME_LABELS, v.outcome)}
                      </p>
                    ) : null}
                    {v.checkedInAt ? (
                      <p>Chegada: {new Date(v.checkedInAt).toLocaleString('pt-BR')}</p>
                    ) : null}
                    {v.checkedOutAt ? (
                      <p>Saída: {new Date(v.checkedOutAt).toLocaleString('pt-BR')}</p>
                    ) : null}
                    {v.executionNotes ? (
                      <p className="mt-1 whitespace-pre-wrap">{v.executionNotes}</p>
                    ) : null}
                    {v.evidence && v.evidence.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {v.evidence.map((ev) => (
                          <li key={ev.id}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/v1/visits/${v.id}/evidence/${ev.id}/file`}
                              alt={ev.caption || 'Foto da visita'}
                              className="h-16 w-16 rounded-md border border-brand-100 object-cover"
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {manage && !cancelled ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-brand-900">
            Adicionar visita
          </h2>
          <FormCard
            error={null}
            onSubmit={addVisit}
            loading={addingVisit}
            submitLabel="Adicionar visita"
          >
            <TextField
              field={{
                name: 'visitStart',
                label: 'Início agendado',
                type: 'datetime-local',
                required: true,
                value: visitStart,
                onChange: setVisitStart,
              }}
            />
            <SelectField
              name="visitEmployeeId"
              label="Funcionário (opcional)"
              value={visitEmployeeId}
              onChange={setVisitEmployeeId}
              options={[
                { value: '', label: 'Sem atribuição' },
                ...employees.map((e) => ({ value: e.id, label: e.name })),
              ]}
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-brand-900">Notas</span>
              <textarea
                name="visitNotes"
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-brand-100 bg-surface px-3 py-2 outline-none ring-brand-500 focus:ring-2"
              />
            </label>
          </FormCard>
        </section>
      ) : null}
    </div>
  );
}
