import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Recuperar senha"
      subtitle="Informe seu e-mail. Se houver conta, enviaremos o link."
      footer="Operações externas · Rotas"
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
