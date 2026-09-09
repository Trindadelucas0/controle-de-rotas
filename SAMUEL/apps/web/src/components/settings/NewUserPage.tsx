'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { FieldGrid, FormCard, FormSection, PageHeader, SelectField, TextField } from '@/components/ui/crud';
import { PasswordField } from '@/components/auth/PasswordField';

export function NewUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'EMPLOYEE',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ user: { id: string } }>('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          password: form.password,
        }),
      });
      router.replace(`/settings/users/${r.user.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha de rede');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Novo usuário" subtitle="Cria conta de acesso" />
      <FormCard error={error} onSubmit={onSubmit} loading={loading} submitLabel="Criar">
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
                name: 'email',
                label: 'E-mail',
                type: 'email',
                required: true,
                value: form.email,
                onChange: (v) => setForm({ ...form, email: v }),
              }}
            />
          </FieldGrid>
        </FormSection>
        <FormSection title="Acesso">
          <FieldGrid>
            <SelectField
              name="role"
              label="Perfil"
              required
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              options={[
                { value: 'ADMIN', label: 'Administrador' },
                { value: 'MANAGER', label: 'Gestor' },
                { value: 'SUPERVISOR', label: 'Supervisor' },
                { value: 'EMPLOYEE', label: 'Funcionário' },
              ]}
            />
            <PasswordField
              id="password"
              name="password"
              label="Senha inicial"
              required
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              autoComplete="new-password"
            />
          </FieldGrid>
        </FormSection>
      </FormCard>
    </div>
  );
}
