'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordField } from './PasswordField';
import { FormError } from './FormError';
import { SubmitButton } from './SubmitButton';
import { apiFetch, ApiError } from '@/lib/api-client';
import { validateChangePassword } from '@/lib/validators';

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const errors = validateChangePassword(currentPassword, newPassword, newPasswordConfirmation);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await apiFetch(
        '/api/v1/auth/change-password',
        {
          method: 'PATCH',
          body: JSON.stringify({ currentPassword, newPassword, newPasswordConfirmation }),
        },
      );
      router.replace('/login?changed=1');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Falha de rede. Tente novamente.');
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4" noValidate>
      <PasswordField
        id="currentPassword"
        name="currentPassword"
        label="Senha atual"
        value={currentPassword}
        onChange={setCurrentPassword}
        disabled={loading}
        error={fieldErrors.currentPassword}
        autoComplete="current-password"
      />
      <PasswordField
        id="newPassword"
        name="newPassword"
        label="Nova senha"
        value={newPassword}
        onChange={setNewPassword}
        disabled={loading}
        error={fieldErrors.newPassword}
        autoComplete="new-password"
      />
      <PasswordField
        id="newPasswordConfirmation"
        name="newPasswordConfirmation"
        label="Confirmar nova senha"
        value={newPasswordConfirmation}
        onChange={setNewPasswordConfirmation}
        disabled={loading}
        error={fieldErrors.newPasswordConfirmation}
        autoComplete="new-password"
      />
      <FormError message={error} />
      <SubmitButton loading={loading}>Alterar senha</SubmitButton>
    </form>
  );
}
