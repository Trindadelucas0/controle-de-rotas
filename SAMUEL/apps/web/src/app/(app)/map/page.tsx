'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const OperationalMap = dynamic(
  () => import('@/components/map/OperationalMap').then((m) => m.OperationalMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-surface text-sm text-[var(--muted)]">
        Carregando MapLibre…
      </div>
    ),
  },
);

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-surface text-sm text-[var(--muted)]">
          Carregando mapa…
        </div>
      }
    >
      <OperationalMap />
    </Suspense>
  );
}
