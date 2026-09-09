import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';

export default function ChangePasswordPage() {
  return (
    <section className="rounded-2xl border border-brand-100 bg-surface p-6">
      <h1 className="mb-4 text-2xl font-bold text-brand-900">Alterar senha</h1>
      <ChangePasswordForm />
    </section>
  );
}
