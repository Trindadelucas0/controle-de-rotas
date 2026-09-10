'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { FieldGrid, FormCard, FormSection, PageHeader, SelectField, TextField } from '@/components/ui/crud';

type CompanyDto = {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
};

export function EditCompanyPage({ companyId }: { companyId: string }) {
  const [form, setForm] = useState({
    name: '',
    tradeName: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    status: 'ACTIVE',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    apiFetch<{ company: CompanyDto }>(`/api/v1/companies/${companyId}`)
      .then((r) => {
        const c = r.company;
        setForm({
          name: c.name || '',
          tradeName: c.tradeName || '',
          document: c.document || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          status: c.status || 'ACTIVE',
        });
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha ao carregar'))
      .finally(() => setLoading(false));
  }, [companyId]);

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setOk(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      await apiFetch(`/api/v1/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          tradeName: form.tradeName.trim() || null,
          document: form.document.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          status: form.status,
        }),
      });
      setOk(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  return (
    <div>
      <PageHeader
        title="Empresa"
        subtitle="Metadados e status do tenant"
        action={
          <Link href="/settings/companies" className="ops-btn ops-btn-ghost">
            Voltar
          </Link>
        }
      />
      {ok ? <p className="mb-3 text-sm text-[var(--ok)]">Salvo.</p> : null}
      <FormCard error={error} onSubmit={onSubmit} loading={saving} submitLabel="Salvar">
        <FormSection title="Dados">
          <FieldGrid>
            <TextField name="name" label="Nome" required value={form.name} onChange={(v) => setField('name', v)} />
            <TextField
              name="tradeName"
              label="Nome fantasia"
              value={form.tradeName}
              onChange={(v) => setField('tradeName', v)}
            />
            <TextField
              name="document"
              label="Documento"
              value={form.document}
              onChange={(v) => setField('document', v)}
            />
            <TextField name="phone" label="Telefone" value={form.phone} onChange={(v) => setField('phone', v)} />
            <TextField
              name="email"
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(v) => setField('email', v)}
            />
            <TextField
              name="address"
              label="Endereço"
              value={form.address}
              onChange={(v) => setField('address', v)}
            />
            <SelectField
              name="status"
              label="Status"
              value={form.status}
              onChange={(v) => setField('status', v)}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'INACTIVE', label: 'INACTIVE' },
              ]}
            />
          </FieldGrid>
        </FormSection>
      </FormCard>
    </div>
  );
}
