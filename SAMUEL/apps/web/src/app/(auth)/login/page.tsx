import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  const params = await searchParams;
  const changedBanner = params.changed === '1';

  return (
    <AuthCard
      title="Entrar"
      subtitle="Acesse sua conta para continuar"
      footer="Operações externas · Rotas"
    >
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Carregando…</p>}>
        <LoginForm changedBanner={changedBanner} />
      </Suspense>
    </AuthCard>
  );
}
