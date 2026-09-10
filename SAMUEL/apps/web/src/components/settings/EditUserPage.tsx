'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import {
  DetailItem,
  DetailSection,
  EditableRecordShell,
  FieldGrid,
  FormCard,
  FormSection,
  PageHeader,
  SelectField,
  TextField,
} from '@/components/ui/crud';
import { PasswordField } from '@/components/auth/PasswordField';
import type { UserDto } from './user-dto';

const roleOpts = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MANAGER', label: 'Gestor' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'EMPLOYEE', label: 'Funcionário' },
];

const statusOpts = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'INACTIVE', label: 'Inativo' },
  { value: 'SUSPENDED', label: 'Suspenso' },
];

export function EditUserPage({ id }: { id: string }) {
  const router = useRouter();
  const [user, setUser] = useState<UserDto | null>(null);
  const [form, setForm] = useState({ name: '', role: 'EMPLOYEE', status: 'ACTIVE' });
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    apiFetch<{ user: UserDto }>(`/api/v1/users/${id}`)
      .then((r) => {
        setUser(r.user);
        setForm({ name: r.user.name, role: r.user.role, status: r.user.status });
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha ao carregar'))
      .finally(() => setLoading(false));
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const r = await apiFetch<{ user: UserDto }>(`/api/v1/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name.trim(), role: form.role, status: form.status }),
      });
      setUser(r.user ?? { ...user!, name: form.name.trim(), role: form.role, status: form.status });
      setMsg('Usuário atualizado.');
      setMode('view');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha de rede');
    } finally {
      setSaving(false);
    }
  }

  async function onResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetting(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setPassword('');
      setShowReset(false);
      setMsg('Senha redefinida. Sessões anteriores foram revogadas.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha de rede');
    } finally {
      setResetting(false);
    }
  }

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  if (!user) {
    return <p className="text-sm text-[var(--danger)]">{error ?? 'Usuário não encontrado'}</p>;
  }

  const roleLabel = roleOpts.find((o) => o.value === user.role)?.label ?? user.role;
  const statusLabel = statusOpts.find((o) => o.value === user.status)?.label ?? user.status;

  return (
    <div className="space-y-8">
      <PageHeader title="Usuário" subtitle={user.email} />
      {msg ? <p className="text-sm text-[var(--ok)]">{msg}</p> : null}
      <EditableRecordShell
        mode={mode}
        onEdit={() => {
          setMsg(null);
          setError(null);
          setForm({ name: user.name, role: user.role, status: user.status });
          setMode('edit');
        }}
        onCancel={() => {
          setForm({ name: user.name, role: user.role, status: user.status });
          setError(null);
          setMode('view');
        }}
        view={
          <DetailSection title="Identificação e permissão">
            <dl className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Nome" value={user.name} />
              <DetailItem label="E-mail" value={user.email} />
              <DetailItem label="Perfil" value={roleLabel} />
              <DetailItem label="Status" value={statusLabel} />
            </dl>
          </DetailSection>
        }
        edit={
          <FormCard error={error} onSubmit={onSubmit} loading={saving} submitLabel="Salvar">
            <FormSection title="Identificação e permissão">
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
                <SelectField
                  name="role"
                  label="Perfil"
                  value={form.role}
                  onChange={(v) => setForm({ ...form, role: v })}
                  options={roleOpts}
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
        }
      />

      {showReset ? (
        <FormCard error={null} onSubmit={onResetPassword} loading={resetting} submitLabel="Redefinir senha">
          <FormSection title="Redefinir senha">
            <p className="-mt-1 text-sm text-[var(--muted)]">Define uma nova senha e força novo login.</p>
            <PasswordField
              id="resetPassword"
              name="resetPassword"
              label="Nova senha"
              required
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="ops-btn ops-btn-secondary text-sm"
              onClick={() => {
                setPassword('');
                setShowReset(false);
              }}
            >
              Cancelar
            </button>
          </FormSection>
        </FormCard>
      ) : (
        <button
          type="button"
          className="ops-btn ops-btn-secondary"
          onClick={() => {
            setMsg(null);
            setShowReset(true);
          }}
        >
          Redefinir senha
        </button>
      )}
    </div>
  );
}
