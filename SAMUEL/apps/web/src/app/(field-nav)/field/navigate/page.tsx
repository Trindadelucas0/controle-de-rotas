'use client';

import dynamic from 'next/dynamic';

const FieldNavigatePage = dynamic(
  () => import('@/components/field/FieldNavigatePage').then((m) => m.FieldNavigatePage),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[100dvh] items-center justify-center bg-[#121212] text-sm text-white/70">
        Abrindo navegação Rotas…
      </div>
    ),
  },
);

export default function NavigatePage() {
  return <FieldNavigatePage />;
}
