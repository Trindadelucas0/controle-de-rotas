'use client';

import { FormError } from '@/components/auth/FormError';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  hint?: string;
};

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3 border-0 p-0">
      <legend className="ops-section-title mb-3 w-full border-b border-[var(--border)] pb-2">
        {title}
      </legend>
      {hint ? <p className="-mt-1 mb-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

export function FormCard({
  children,
  error,
  onSubmit,
  loading,
  submitLabel,
  submitHint,
  secondaryAction,
}: {
  children: React.ReactNode;
  error?: string | null;
  onSubmit: (e: React.FormEvent) => void;
  loading?: boolean;
  submitLabel: string;
  submitHint?: string;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="ops-surface space-y-6 rounded-[10px] p-5 sm:p-6" noValidate>
      {error ? <FormError message={error} /> : null}
      <fieldset disabled={!!loading} className="min-w-0 space-y-6 border-0 p-0 disabled:opacity-70">
        {children}
        <div className="flex flex-col items-stretch gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-end">
          {submitHint ? <p className="text-xs text-[var(--muted)] sm:mr-auto">{submitHint}</p> : null}
          {secondaryAction}
          <SubmitButton loading={!!loading}>{submitLabel}</SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function DetailItem({
  label,
  value,
  empty = '—',
  className,
}: {
  label: string;
  value?: React.ReactNode | null;
  empty?: string;
  className?: string;
}) {
  const isEmpty =
    value == null ||
    value === '' ||
    (typeof value === 'string' && value.trim() === '');
  return (
    <div className={className ?? 'min-w-0'}>
      <dt className="ops-label">{label}</dt>
      <dd
        className={`mt-0.5 break-words text-sm font-medium text-brand-900 ${isEmpty ? 'text-[var(--muted)]' : ''}`}
      >
        {isEmpty ? empty : value}
      </dd>
    </div>
  );
}

export function DetailSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="ops-section-title mb-0 w-full border-b border-[var(--border)] pb-2">{title}</h2>
      {hint ? <p className="-mt-1 mb-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      {children}
    </section>
  );
}

export function DetailCard({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="ops-surface space-y-6 rounded-[10px] p-5 sm:p-6">
      {action ? <div className="flex flex-wrap items-center justify-end gap-2">{action}</div> : null}
      {children}
    </div>
  );
}

export function EditableRecordShell({
  mode,
  onEdit,
  onCancel,
  view,
  edit,
  editLabel = 'Editar',
  cancelLabel = 'Cancelar',
}: {
  mode: 'view' | 'edit';
  onEdit: () => void;
  onCancel: () => void;
  view: React.ReactNode;
  edit: React.ReactNode;
  editLabel?: string;
  cancelLabel?: string;
}) {
  if (mode === 'edit') {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="ops-btn ops-btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
        {edit}
      </div>
    );
  }

  return (
    <DetailCard
      action={
        <button
          type="button"
          className="ops-btn ops-btn-secondary inline-flex items-center gap-2"
          onClick={onEdit}
          aria-label={editLabel}
        >
          <PencilIcon />
          {editLabel}
        </button>
      }
    >
      {view}
    </DetailCard>
  );
}

export function TextField({ field }: { field: Field }) {
  return (
    <label className="block text-sm">
      <span className="ops-label">
        {field.label}
        {field.required ? <span className="ml-0.5 text-accent">*</span> : null}
      </span>
      {field.hint ? <span className="mb-1.5 block text-xs font-normal text-[var(--muted)]">{field.hint}</span> : null}
      <input
        name={field.name}
        type={field.type || 'text'}
        required={field.required}
        value={field.value}
        placeholder={field.placeholder}
        onChange={(e) => field.onChange(e.target.value)}
        className="ops-input"
        aria-invalid={Boolean(field.error)}
      />
      {field.error ? (
        <span className="mt-1 block text-xs text-[var(--danger)]" role="alert">
          {field.error}
        </span>
      ) : null}
    </label>
  );
}

export function SelectField({
  name,
  label,
  value,
  onChange,
  options,
  required,
  hint,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="ops-label">
        {label}
        {required ? <span className="ml-0.5 text-accent">*</span> : null}
      </span>
      {hint ? <span className="mb-1.5 block text-xs font-normal text-[var(--muted)]">{hint}</span> : null}
      <select
        name={name}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="ops-input"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, React.ReactNode>[];
  empty: string;
}) {
  if (!rows || rows.length === 0) {
    return (
      <p className="ops-surface rounded-[10px] border-dashed px-5 py-10 text-center text-sm text-[var(--muted)]">
        {empty}
      </p>
    );
  }
  return (
    <div className="ops-surface overflow-x-auto rounded-[10px]">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2.5 font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-[var(--border)] last:border-0 hover:bg-white/[0.03]"
            >
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2.5 text-brand-900">
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
