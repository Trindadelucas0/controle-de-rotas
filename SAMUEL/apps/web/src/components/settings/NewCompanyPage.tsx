'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { FieldGrid, FormCard, FormSection, PageHeader, TextField } from '@/components/ui/crud';

export function NewCompanyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    tradeName: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<{ company: { id: string } }>('/api/v1/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          tradeName: form.tradeName.trim() || null,
          document: form.document.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          adminName: form.adminName.trim(),
          adminEmail: form.adminEmail.trim(),
          adminPassword: form.adminPassword,
        }),
      });
      router.replace(`/settings/companies/${created.company.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao criar empresa');
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Nova empresa"
        subtitle="Cria o tenant e o primeiro administrador"
        action={
          <Link href="/settings/companies" className="ops-btn ops-btn-ghost">
            Voltar
          </Link>
        }
      />
      <FormCard
        error={error}
        onSubmit={onSubmit}
        loading={saving}
        submitLabel="Criar empresa"
        secondaryAction={
          <Link href="/settings/companies" className="ops-btn ops-btn-secondary">
            Cancelar
          </Link>
        }
      >
        <FormSection title="Dados da empresa">
          <FieldGrid>
            <TextField
              field={{
                name: 'name',
                label: 'Nome',
                required: true,
                value: form.name,
                onChange: (v) => setField('name', v),
              }}
            />
            <TextField
              field={{
                name: 'tradeName',
                label: 'Nome fantasia',
                value: form.tradeName,
                onChange: (v) => setField('tradeName', v),
              }}
            />
            <TextField
              field={{
                name: 'document',
                label: 'Documento',
                value: form.document,
                onChange: (v) => setField('document', v),
              }}
            />
            <TextField
              field={{
                name: 'phone',
                label: 'Telefone',
                value: form.phone,
                onChange: (v) => setField('phone', v),
              }}
            />
            <TextField
              field={{
                name: 'email',
                label: 'E-mail da empresa',
                type: 'email',
                value: form.email,
                onChange: (v) => setField('email', v),
              }}
            />
            <TextField
              field={{
                name: 'address',
                label: 'Endereço',
                value: form.address,
                onChange: (v) => setField('address', v),
              }}
            />
          </FieldGrid>
        </FormSection>
        <FormSection title="Administrador inicial" hint="Esse usuário faz login só nesta empresa (e-mail único na plataforma).">
          <FieldGrid>
            <TextField
              field={{
                name: 'adminName',
                label: 'Nome',
                required: true,
                value: form.adminName,
                onChange: (v) => setField('adminName', v),
              }}
            />
            <TextField
              field={{
                name: 'adminEmail',
                label: 'E-mail',
                type: 'email',
                required: true,
                value: form.adminEmail,
                onChange: (v) => setField('adminEmail', v),
              }}
            />
            <TextField
              field={{
                name: 'adminPassword',
                label: 'Senha',
                type: 'password',
                required: true,
                value: form.adminPassword,
                onChange: (v) => setField('adminPassword', v),
                hint: 'Mínimo 8 caracteres',
              }}
            />
          </FieldGrid>
        </FormSection>
      </FormCard>
    </div>
  );
}
