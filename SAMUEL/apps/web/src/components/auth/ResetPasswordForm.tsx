'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { PasswordField } from './PasswordField';
import { FormError } from './FormError';
import { SubmitButton } from './SubmitButton';
import { apiFetch, ApiError } from '@/lib/api-client';
import { validateReset } from '@/lib/validators';

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <FormError message="Link inválido ou incompleto." />
        <p className="text-center text-sm">
          <Link href="/login" className="ops-link">
            Voltar ao login
          </Link>
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-[6px] border border-[var(--ok)]/30 bg-[var(--ok-bg)] px-3 py-2 text-sm text-[var(--ok)]">
          Senha alterada. Faça login.
        </div>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validateReset(password, passwordConfirmation);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await apiFetch(
        '/api/v1/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({ token, password, passwordConfirmation }),
        },
        { authRedirect: false, retryOn401: false },
      );
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Falha de rede. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <PasswordField
        id="password"
        name="password"
        label="Nova senha"
        value={password}
        onChange={setPassword}
        disabled={loading}
        error={fieldErrors.password}
        autoComplete="new-password"
      />
      <PasswordField
        id="passwordConfirmation"
        name="passwordConfirmation"
        label="Confirmar senha"
        value={passwordConfirmation}
        onChange={setPasswordConfirmation}
        disabled={loading}
        error={fieldErrors.passwordConfirmation}
        autoComplete="new-password"
      />
      <FormError message={error} />
      <SubmitButton loading={loading}>Redefinir senha</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="ops-link">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
