'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { FormError } from './FormError';
import { SubmitButton } from './SubmitButton';
import { apiFetch, ApiError } from '@/lib/api-client';
import { validateForgot } from '@/lib/validators';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validateForgot(email);
    setFieldError(errors.email);
    if (errors.email) return;

    setLoading(true);
    try {
      const data = await apiFetch<{ message: string }>(
        '/api/v1/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        },
        { authRedirect: false, retryOn401: false },
      );
      setSuccessMessage(data.message);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Muitas tentativas. Aguarde e tente de novo.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Falha de rede. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (successMessage) {
    return (
      <div className="space-y-4">
        <div className="rounded-[6px] border border-[var(--ok)]/30 bg-[var(--ok-bg)] px-3 py-2 text-sm text-[var(--ok)]" role="status">
          {successMessage}
        </div>
        <p className="text-center text-sm">
          <Link href="/login" className="ops-link">
            Voltar ao login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-brand-900">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          disabled={loading}
          onChange={(e) => setEmail(e.target.value)}
          className="ops-input disabled:opacity-60"
        />
        {fieldError ? (
          <p className="text-xs text-[var(--danger)]" role="alert">
            {fieldError}
          </p>
        ) : null}
      </div>

      <FormError message={error} />
      <SubmitButton loading={loading} className="w-full">Enviar link</SubmitButton>

      <p className="text-center text-sm">
        <Link href="/login" className="ops-link">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
