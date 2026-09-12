'use client';

import { useState } from 'react';

export type RecordPointForm = {
  name: string;
  phone: string;
  document: string;
  city: string;
  state: string;
  street: string;
  notes: string;
};

const EMPTY: RecordPointForm = {
  name: '',
  phone: '',
  document: '',
  city: '',
  state: '',
  street: '',
  notes: '',
};

type Props = {
  title?: string;
  initial?: Partial<RecordPointForm>;
  busy?: boolean;
  error?: string | null;
  submitLabel?: string;
  laterLabel?: string;
  showLater?: boolean;
  onCancel: () => void;
  onSave: (form: RecordPointForm, completeProfile: boolean) => void;
};

export function RecordToCustomerSheet({
  title = 'Novo cliente neste ponto',
  initial,
  busy,
  error,
  submitLabel = 'Salvar ponto e continuar',
  laterLabel = 'Só o nome — completar depois',
  showLater = true,
  onCancel,
  onSave,
}: Props) {
  const [form, setForm] = useState<RecordPointForm>({ ...EMPTY, ...initial });
  const nameOk = form.name.trim().length >= 2;
  const extrasFilled = Boolean(
    form.phone.trim() ||
      form.document.trim() ||
      form.city.trim() ||
      form.street.trim(),
  );

  function set<K extends keyof RecordPointForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-point-title"
    >
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-[10px] border border-[var(--border)] bg-surface p-5 text-brand-900 shadow-lg">
        <h2 id="record-point-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Nome obrigatório. Telefone, documento e endereço podem ir agora ou depois.
        </p>

        {error ? (
          <p className="mt-3 rounded-[8px] bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium">Nome da fazenda *</span>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full ops-input text-sm"
            autoComplete="off"
            required
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Telefone</span>
          <input
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="w-full ops-input text-sm"
            inputMode="tel"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Documento</span>
          <input
            value={form.document}
            onChange={(e) => set('document', e.target.value)}
            className="w-full ops-input text-sm"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Rua / acesso</span>
          <input
            value={form.street}
            onChange={(e) => set('street', e.target.value)}
            className="w-full ops-input text-sm"
          />
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="col-span-2 block text-sm">
            <span className="mb-1 block font-medium">Cidade</span>
            <input
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              className="w-full ops-input text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">UF</span>
            <input
              value={form.state}
              onChange={(e) => set('state', e.target.value.slice(0, 2).toUpperCase())}
              className="w-full ops-input text-sm"
              maxLength={2}
            />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Observações</span>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="w-full ops-input min-h-16 text-sm"
          />
        </label>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={!nameOk || busy}
            className="ops-btn ops-btn-primary min-h-11"
            onClick={() => onSave(form, showLater ? extrasFilled : true)}
          >
            {busy ? 'Salvando…' : submitLabel}
          </button>
          {showLater ? (
            <button
              type="button"
              disabled={!nameOk || busy}
              className="ops-btn ops-btn-secondary min-h-11"
              onClick={() => onSave(form, false)}
            >
              {laterLabel}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            className="text-sm text-[var(--muted)] underline"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
