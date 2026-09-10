'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { DataTable, PageHeader } from '@/components/ui/crud';

export type CompanyListItem = {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  email: string | null;
  status: string;
};

export function CompaniesListPage() {
  const [rows, setRows] = useState<CompanyListItem[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(search = q, statusFilter = status) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString() ? `?${params}` : '';
      const r = await apiFetch<{ companies: CompanyListItem[] }>(`/api/v1/companies${qs}`);
      setRows(Array.isArray(r.companies) ? r.companies : []);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha de rede');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load('', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle="Provisionamento de tenants da plataforma"
        action={
          <Link href="/settings/companies/new" className="ops-btn ops-btn-primary">
            Nova empresa
          </Link>
        }
      />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nome, documento ou e-mail"
          className="min-w-[12rem] flex-1 ops-input text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-40 ops-input text-sm"
          aria-label="Status"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
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
          empty="Nenhuma empresa cadastrada."
          columns={[
            { key: 'name', label: 'Nome' },
            { key: 'document', label: 'Documento' },
            { key: 'email', label: 'E-mail' },
            { key: 'status', label: 'Status' },
            { key: 'actions', label: '' },
          ]}
          rows={rows.map((c) => ({
            name: c.tradeName ? `${c.name} (${c.tradeName})` : c.name,
            document: c.document || '—',
            email: c.email || '—',
            status: c.status,
            actions: (
              <Link href={`/settings/companies/${c.id}`} className="ops-link">
                Abrir
              </Link>
            ),
          }))}
        />
      )}
    </div>
  );
}
