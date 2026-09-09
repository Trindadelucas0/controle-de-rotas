'use client';

import { createContext, useContext } from 'react';
import type { SessionUser } from '@/lib/auth';

export const SessionContext = createContext<SessionUser | null>(null);

export function useSessionUser() {
  return useContext(SessionContext);
}
