import { Suspense } from 'react';
import { ServiceOrderNewPage } from '@/components/services/ServicesPages';

export default function Page() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface" />}>
      <ServiceOrderNewPage />
    </Suspense>
  );
}
