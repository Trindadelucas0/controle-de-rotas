'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { DataTable, FieldGrid, FormCard, FormSection, PageHeader, SelectField, TextField } from '@/components/ui/crud';
import { PasswordField } from '@/components/auth/PasswordField';
import { useSessionUser } from '@/lib/session-context';
import {
  OperationalSummaryStrip,
} from '@/components/ops/OperationalSummaryStrip';
import { EntityContextPanel, operationalLabel } from '@/components/ops/EntityContextPanel';
import { formatMetersKm, type EmployeesSummary, type EntityContextCard } from '@/lib/ops-types';

export type EmployeeLoginUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

export type EmployeeDto = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  jobTitle: string | null;
  registration: string | null;
  specialties: string[];
  region: string | null;
  status: string;
  userId: string | null;
  user: EmployeeLoginUser | null;
};

const statusOpts = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'INACTIVE', label: 'Inativo' },
  { value: 'ON_LEAVE', label: 'Afastado' },
  { value: 'SUSPENDED', label: 'Suspenso' },
];

export function EmployeesListPage() {
  const [rows, setRows] = useState<
    (EmployeeDto & {
      routeTodayId?: string | null;
      routeTodayStatus?: string | null;
      vehiclePlate?: string | null;
      operational?: string | null;
    })[]
  >([]);
  const [summary, setSummary] = useState<EmployeesSummary | null>(null);
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
          employees: (EmployeeDto & {
            routeTodayId: string | null;
            routeTodayStatus: string | null;
            vehiclePlate: string | null;
            operational: string | null;
          })[];
        }>(`/api/v1/ops/employees/list-enriched${qs}`),
        apiFetch<EmployeesSummary>('/api/v1/ops/employees/summary').catch(() => null),
      ]);
      setRows(listRes.employees);
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
        title="Funcionários"
        action={
          <Link href="/employees/new" className="ops-btn ops-btn-primary">
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
                { label: 'Com login', value: summary.withLogin },
                { label: 'Rotas hoje', value: summary.routesToday },
                { label: 'GPS online', value: summary.liveOnline },
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
          placeholder="Buscar"
          aria-label="Buscar funcionários"
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
          empty="Nenhum funcionário cadastrado. Cadastre a equipe para atribuir rotas."
          columns={[
            { key: 'name', label: 'Nome' },
            { key: 'jobTitle', label: 'Cargo' },
            { key: 'status', label: 'Status' },
            { key: 'operational', label: 'Operacional' },
            { key: 'route', label: 'Rota hoje' },
            { key: 'access', label: 'Acesso' },
            { key: 'actions', label: '' },
          ]}
          rows={rows.map((e) => ({
            name: e.name,
            jobTitle: e.jobTitle || '—',
            status: e.status,
            operational: operationalLabel(e.operational),
            route: e.routeTodayStatus
              ? `${e.routeTodayStatus}${e.vehiclePlate ? ` · ${e.vehiclePlate}` : ''}`
              : '—',
            access: e.userId ? 'Com login' : 'Sem login',
            actions: (
              <Link href={`/employees/${e.id}`} className="ops-link">
                Editar
              </Link>
            ),
          }))}
        />
      )}
    </div>
  );
}

function EmployeeForm({
  mode,
  initial,
  onSave,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<EmployeeDto>;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const session = useSessionUser();
  const isAdmin = session?.role === 'ADMIN';
  const hasLogin = Boolean(initial?.userId);
  const loginEmail = initial?.user?.email || initial?.email || '';

  const [form, setForm] = useState({
    name: initial?.name || '',
    phone: initial?.phone || '',
    email: loginEmail,
    jobTitle: initial?.jobTitle || '',
    registration: initial?.registration || '',
    specialties: (initial?.specialties || []).join(', '),
    region: initial?.region || '',
    status: initial?.status || 'ACTIVE',
    password: '',
  });
  const [createAccess, setCreateAccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const wantsLogin = mode === 'create' || createAccess;

    if (!name) {
      setError('Informe o nome.');
      return;
    }
    if (wantsLogin && !email) {
      setError('Informe o e-mail de acesso.');
      return;
    }
    if (wantsLogin && form.password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    const body: Record<string, unknown> = {
      name,
      phone: form.phone.trim() || null,
      jobTitle: form.jobTitle.trim() || null,
      registration: form.registration.trim() || null,
      specialties: form.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      region: form.region.trim() || null,
      status: form.status,
    };

    if (!hasLogin) {
      body.email = email || null;
    }
    if (wantsLogin) {
      body.email = email;
      body.password = form.password;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave(body);
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
              name: 'name',
              label: 'Nome',
              required: true,
              value: form.name,
              onChange: (v) => setForm({ ...form, name: v }),
            }}
          />
          <TextField
            field={{
              name: 'phone',
              label: 'Telefone',
              value: form.phone,
              onChange: (v) => setForm({ ...form, phone: v }),
            }}
          />
        </FieldGrid>
      </FormSection>
      <FormSection title="Acesso ao Rotas">
        {hasLogin ? (
          <div className="rounded-[8px] border border-[var(--border)] bg-[#161618] p-4">
            <p className="text-sm font-medium text-brand-900">Login ativo</p>
            <p className="mt-2 text-sm text-brand-800">
              E-mail de login:{' '}
              <span className="font-semibold">{initial?.user?.email || initial?.email || '—'}</span>
            </p>
            {isAdmin && initial?.userId ? (
              <Link href={`/settings/users/${initial.userId}`} className="mt-2 inline-block text-sm ops-link">
                Redefinir senha em Usuários
              </Link>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Peça a um administrador para redefinir a senha em Usuários.
              </p>
            )}
          </div>
        ) : (
          <TextField
            field={{
              name: 'email',
              label: mode === 'create' ? 'E-mail (login)' : 'E-mail',
              type: 'email',
              required: mode === 'create' || createAccess,
              value: form.email,
              onChange: (v) => setForm({ ...form, email: v }),
            }}
          />
        )}
        {mode === 'create' ? (
          <>
            <PasswordField
              id="employee-password"
              name="password"
              label="Senha de acesso"
              required
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              autoComplete="new-password"
            />
            <p className="text-sm text-[var(--muted)]">
              Mínimo de 8 caracteres. O funcionário entra no Rotas com este e-mail e senha.
            </p>
          </>
        ) : null}
        {!hasLogin && mode === 'edit' ? (
          <fieldset className="space-y-3 rounded-[8px] border border-[var(--border)] p-4">
            <legend className="px-1 text-sm font-medium text-brand-900">Criar acesso</legend>
            <label className="flex items-center gap-2 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={createAccess}
                onChange={(e) => setCreateAccess(e.target.checked)}
              />
              Criar acesso ao Rotas (e-mail + senha)
            </label>
            {createAccess ? (
              <PasswordField
                id="employee-create-access-password"
                name="password"
                label="Senha de acesso"
                required
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                autoComplete="new-password"
              />
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Sem login este funcionário não recebe rota de campo. Você pode criar o acesso agora ou
                depois.
              </p>
            )}
          </fieldset>
        ) : null}
      </FormSection>
      <FormSection title="Função">
        <FieldGrid>
          <TextField
            field={{
              name: 'jobTitle',
              label: 'Cargo',
              value: form.jobTitle,
              onChange: (v) => setForm({ ...form, jobTitle: v }),
            }}
          />
          <TextField
            field={{
              name: 'registration',
              label: 'Matrícula',
              value: form.registration,
              onChange: (v) => setForm({ ...form, registration: v }),
            }}
          />
          <TextField
            field={{
              name: 'specialties',
              label: 'Especialidades (separadas por vírgula)',
              value: form.specialties,
              onChange: (v) => setForm({ ...form, specialties: v }),
            }}
          />
          <TextField
            field={{
              name: 'region',
              label: 'Região',
              value: form.region,
              onChange: (v) => setForm({ ...form, region: v }),
            }}
          />
          <SelectField
            name="status"
            label="Status"
            value={form.status}
            onChange={(v) => setForm({ ...form, status: v })}
            options={statusOpts}
          />
        </FieldGrid>
      </FormSection>
    </FormCard>
  );
}

export function NewEmployeePage() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="Novo funcionário" subtitle="Cria o cadastro e o login de campo na mesma etapa" />
      <EmployeeForm
        mode="create"
        onSave={async (body) => {
          const r = await apiFetch<{ employee: { id: string } }>('/api/v1/employees', {
            method: 'POST',
            body: JSON.stringify(body),
          });
          router.replace(`/employees/${r.employee.id}`);
        }}
      />
    </div>
  );
}

export function EditEmployeePage({ id }: { id: string }) {
  const [data, setData] = useState<EmployeeDto | null>(null);
  const [context, setContext] = useState<{ employee: EntityContextCard } | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ employee: EmployeeDto }>(`/api/v1/employees/${id}`)
      .then((r) => setData(r.employee))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha'));
  }, [id]);

  useEffect(() => {
    setCtxLoading(true);
    apiFetch<{ employee: EntityContextCard }>(`/api/v1/ops/employees/${id}`)
      .then((r) => {
        setContext(r);
        setCtxError(null);
      })
      .catch((e) => setCtxError(e instanceof ApiError ? e.message : 'Contexto indisponível'))
      .finally(() => setCtxLoading(false));
  }, [id]);

  if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;

  const card = context?.employee;
  const rel = card?.relacionamentos as {
    routeToday?: { id: string; status: string; vehicle?: { plate: string } } | null;
    loginUser?: { email: string } | null;
  };

  return (
    <div>
      <PageHeader title="Editar funcionário" />
      <EntityContextPanel
        title={data.name}
        statusLabel={card?.statusAtual ?? data.status}
        loading={ctxLoading}
        error={ctxError}
        metrics={
          card
            ? [
                {
                  label: 'Operacional',
                  value: operationalLabel(
                    String((card.summary as { operational?: string }).operational ?? ''),
                  ),
                },
                {
                  label: 'Paradas hoje',
                  value:
                    card.metrics.routeStopsToday != null
                      ? String(card.metrics.routeStopsToday)
                      : '—',
                },
                {
                  label: 'Km plan. hoje',
                  value: formatMetersKm(card.metrics.plannedDistanceMeters),
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
          {
            label: 'Veículo',
            value: rel?.routeToday?.vehicle?.plate ?? '—',
          },
          {
            label: 'Login',
            value: rel?.loginUser?.email ?? (data.userId ? 'Com login' : 'Sem login'),
          },
        ]}
        timeline={card?.timeline ?? []}
        acoes={card?.acoes ?? []}
      />
      {msg ? <p className="mb-3 text-sm text-[var(--ok)]">{msg}</p> : null}
      <EmployeeForm
        key={`${data.id}-${data.userId ?? 'no-login'}`}
        mode="edit"
        initial={data}
        onSave={async (body) => {
          const r = await apiFetch<{ employee: EmployeeDto }>(`/api/v1/employees/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          });
          setData(r.employee);
          setMsg(body.password ? 'Acesso criado. O funcionário já pode entrar no Rotas.' : 'Salvo.');
        }}
      />
    </div>
  );
}
