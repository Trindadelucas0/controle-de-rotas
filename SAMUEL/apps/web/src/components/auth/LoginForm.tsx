'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PasswordField } from './PasswordField';
import { FormError } from './FormError';
import { SubmitButton } from './SubmitButton';
import { apiFetch, ApiError } from '@/lib/api-client';
import { safeNextPath, validateLogin } from '@/lib/validators';

export function LoginForm({ changedBanner }: { changedBanner?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validateLogin(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await apiFetch(
        '/api/v1/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        },
        { authRedirect: false, retryOn401: false },
      );
      router.replace(safeNextPath(searchParams.get('next')));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError('Muitas tentativas. Aguarde e tente de novo.');
        } else if (err.status === 403) {
          setError(err.message || 'Usuário inativo ou suspenso.');
        } else if (err.status === 401) {
          setError('E-mail ou senha inválidos.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Falha de rede. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} method="post" className="space-y-4" noValidate>
      {changedBanner ? (
        <div className="rounded-[6px] border border-[var(--ok)]/30 bg-[var(--ok-bg)] px-3 py-2 text-sm text-[var(--ok)]">
          Senha alterada. Entre novamente.
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="email" className="ops-label">
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
          aria-invalid={Boolean(fieldErrors.email)}
        />
        {fieldErrors.email ? (
          <p className="text-xs text-[var(--danger)]" role="alert">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <PasswordField
        id="password"
        name="password"
        label="Senha"
        value={password}
        onChange={setPassword}
        disabled={loading}
        error={fieldErrors.password}
        autoComplete="current-password"
      />

      <FormError message={error} />

      <SubmitButton loading={loading} className="w-full">Entrar</SubmitButton>

      <p className="text-center text-sm">
        <Link href="/forgot-password" className="ops-link text-sm">
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}
