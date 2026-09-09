import { AuthCard } from '@/components/auth/AuthCard';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? null;

  return (
    <AuthCard title="Nova senha" subtitle="Defina uma nova senha para sua conta" footer="Operações externas · Rotas">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
