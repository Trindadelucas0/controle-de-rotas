'use client';

import { useEffect } from 'react';
import { isLocalDevHost } from '@/lib/pwa';

/** Registra SW só em contexto seguro (HTTPS). Localhost fica de fora para não atrapalhar o hot reload. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return;
    if (isLocalDevHost()) return;
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // instalação PWA fica só com o manifesto se o SW falhar
    });
  }, []);
  return null;
}
