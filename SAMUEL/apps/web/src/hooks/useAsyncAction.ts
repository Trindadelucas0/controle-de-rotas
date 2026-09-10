'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Trava de reentrada para mutações: ignora cliques enquanto a Promise estiver em voo.
 */
export function useAsyncAction() {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (pendingRef.current) return undefined;
    pendingRef.current = true;
    setPending(true);
    try {
      return await fn();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, []);

  return { run, pending };
}
