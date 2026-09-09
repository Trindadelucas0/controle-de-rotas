export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[400px] flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      <div className="ops-surface rounded-[10px] p-5 sm:p-6">{children}</div>
      {footer ? <div className="mt-4 text-center text-sm text-[var(--muted)]">{footer}</div> : null}
    </div>
  );
}
