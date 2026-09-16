'use client';

import { useEffect, useRef, useState } from 'react';
import { compressFieldPhoto } from '@/lib/field-photo';

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
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function applyFile(next: File | null) {
    if (!next) {
      setError(null);
      onChange(null);
      return;
    }
    try {
      const compressed = await compressFieldPhoto(next);
      setError(null);
      onChange(compressed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Formato inválido. Use JPEG, PNG ou WebP.');
      onChange(null);
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-brand-900">
        {label}
        {required ? ' *' : ''}
      </p>
      <input
        id={id}
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          void applyFile(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      <input
        id={`${id}-gallery`}
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          void applyFile(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
          className="ops-btn ops-btn-secondary text-sm disabled:opacity-60"
        >
          {file ? 'Trocar foto' : 'Tirar foto'}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
          className="rounded-xl border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-900 disabled:opacity-60"
        >
          Galeria
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
      {error ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
