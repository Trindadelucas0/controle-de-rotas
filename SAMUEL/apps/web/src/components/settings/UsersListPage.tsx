'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { DataTable, PageHeader } from '@/components/ui/crud';
import type { UserDto } from './user-dto';

export type { UserDto };

export function UsersListPage() {
  const [rows, setRows] = useState<UserDto[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(search = q) {
    setLoading(true);
    try {
      const qs = search ? `?q=${encodeURIComponent(search)}` : '';
      const r = await apiFetch<{ users: UserDto[] }>(`/api/v1/users${qs}`);
      setRows(Array.isArray(r.users) ? r.users : []);
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
        title="Usuários"
        subtitle="Contas de acesso da empresa"
        action={
          <Link href="/settings/users/new" className="ops-btn ops-btn-primary">
            Novo usuário
          </Link>
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
          placeholder="Buscar nome ou e-mail"
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
          empty="Nenhuma conta de acesso. Crie um usuário para liberar login."
          columns={[
            { key: 'name', label: 'Nome' },
            { key: 'email', label: 'E-mail' },
            { key: 'role', label: 'Perfil' },
            { key: 'status', label: 'Status' },
            { key: 'actions', label: '' },
          ]}
          rows={rows.map((u) => ({
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            actions: (
              <Link href={`/settings/users/${u.id}`} className="ops-link">
                Editar
              </Link>
            ),
          }))}
        />
      )}
    </div>
  );
}
