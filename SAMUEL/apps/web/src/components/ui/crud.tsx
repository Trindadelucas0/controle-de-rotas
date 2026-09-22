'use client';

import { Inbox, Pencil } from 'lucide-react';
import { FormError } from '@/components/auth/FormError';
import { IconTile } from '@/components/reui/icon-tile';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { MobileActionBar } from '@/components/ui/MobileActionBar';
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
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <IconTile variant="outline" size="sm" aria-hidden="true">
            {icon}
          </IconTile>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-brand-900 sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">{action}</div> : null}
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
        <MobileActionBar>
          {submitHint ? <p className="order-last text-xs text-[var(--muted)] md:order-first md:mr-auto">{submitHint}</p> : null}
          {secondaryAction}
          <SubmitButton loading={!!loading}>{submitLabel}</SubmitButton>
        </MobileActionBar>
      </fieldset>
    </form>
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
          <Pencil size={16} aria-hidden="true" />
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
  mobileTitleKey,
  mobileKeys,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, React.ReactNode>[];
  empty: string;
  /** Chave usada como título do card no mobile (default: primeira coluna ≠ actions). */
  mobileTitleKey?: string;
  /** Campos no card além do título (default: demais colunas exceto actions). */
  mobileKeys?: string[];
}) {
  if (!rows || rows.length === 0) {
    return (
      <Empty className="ops-surface rounded-[10px] border-dashed px-5 py-10">
        <EmptyHeader>
          <EmptyMedia>
            <IconTile variant="outline" size="lg" aria-hidden="true">
              <Inbox />
            </IconTile>
          </EmptyMedia>
          <EmptyDescription className="text-[var(--muted)]">{empty}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const dataCols = columns.filter((c) => c.key !== 'actions');
  const titleKey = mobileTitleKey ?? dataCols[0]?.key;
  const detailKeys =
    mobileKeys ??
    dataCols.filter((c) => c.key !== titleKey).map((c) => c.key);
  const labelByKey = Object.fromEntries(columns.map((c) => [c.key, c.label]));
  const hasActions = columns.some((c) => c.key === 'actions');

  return (
    <>
      {/* Mobile: cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row, i) => (
          <li key={i} className="ops-surface rounded-[10px] p-4">
            {titleKey ? (
              <div className="text-base font-semibold text-brand-900">{row[titleKey]}</div>
            ) : null}
            <dl className="mt-3 space-y-2">
              {detailKeys.map((key) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {labelByKey[key] || key}
                  </dt>
                  <dd className="text-sm text-brand-900">{row[key]}</dd>
                </div>
              ))}
            </dl>
            {hasActions && row.actions != null ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3 [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>a]:px-3 [&>button]:min-h-11">
                {row.actions}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {/* Desktop: tabela */}
      <div className="ops-surface hidden overflow-x-auto rounded-[10px] md:block">
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
    </>
  );
}
