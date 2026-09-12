'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  id: string;
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
};

export function OdometerPhotoCapture({
  id,
  file,
  onChange,
  required,
  disabled,
  label = 'Foto do odômetro',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-brand-900">
        {label}
        {required ? ' *' : ''}
      </p>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null;
          onChange(next);
          e.target.value = '';
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="ops-btn ops-btn-secondary text-sm disabled:opacity-60"
        >
          {file ? 'Trocar foto' : 'Tirar foto'}
        </button>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Prévia do odômetro"
            className="h-16 w-16 rounded-lg object-cover border border-[var(--border)]"
          />
        ) : (
          <span className="text-xs text-[var(--muted)]">JPEG, PNG ou WebP · máx. 5 MB</span>
        )}
      </div>
    </div>
  );
}
