import { FieldPwaLocationGate } from '@/components/field/FieldPwaLocationGate';
import type { ReactNode } from 'react';

export default function FieldLayout({ children }: { children: ReactNode }) {
  return <FieldPwaLocationGate>{children}</FieldPwaLocationGate>;
}
