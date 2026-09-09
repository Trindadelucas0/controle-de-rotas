'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  geolocationErrorMessage,
  isInsecureGeolocationContext,
  requestCurrentPosition,
} from '@/lib/field-tracking';
import { InsecureHttpBanner } from '@/components/field/InsecureHttpBanner';
import { isIosDevice, isLocalDevHost, isPwaStandalone } from '@/lib/pwa';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Phase = 'checking' | 'need-pwa' | 'need-location' | 'ready';

type PwaHint = 'ios' | 'android-prompt' | 'android-manual' | 'open-icon';

function GateShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)] px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="field-pwa-gate-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-brand-100 bg-surface p-6">
        <p className="ops-label mb-0">Campo</p>
        <h1 id="field-pwa-gate-title" className="mt-1 text-2xl font-bold text-brand-900">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

export function FieldPwaLocationGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [pwaHint, setPwaHint] = useState<PwaHint>('android-manual');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [insecureHttp, setInsecureHttp] = useState(false);

  const tryLocation = useCallback(async (): Promise<boolean> => {
    setRequestingLocation(true);
    setLocationError(null);
    try {
      if (!navigator.geolocation) {
        setLocationError('Geolocation indisponível neste dispositivo');
        return false;
      }
      if (typeof navigator.permissions?.query === 'function') {
        try {
          const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (perm.state === 'granted') return true;
        } catch {
          // Safari antigo: segue para getCurrentPosition
        }
      }
      await requestCurrentPosition();
      return true;
    } catch (err) {
      setLocationError(
        geolocationErrorMessage(err as GeolocationPositionError),
      );
      return false;
    } finally {
      setRequestingLocation(false);
    }
  }, []);

  const resolvePhase = useCallback(async () => {
    if (isLocalDevHost()) {
      setPhase('ready');
      return;
    }
    if (isInsecureGeolocationContext()) {
      setInsecureHttp(true);
      setPhase('ready');
      return;
    }
    if (!isPwaStandalone()) {
      setPwaHint((prev) => {
        if (prev === 'open-icon') return prev;
        if (isIosDevice()) return 'ios';
        return deferred ? 'android-prompt' : 'android-manual';
      });
      setPhase('need-pwa');
      return;
    }

    let alreadyGranted = false;
    try {
      if (typeof navigator.permissions?.query === 'function') {
        const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        alreadyGranted = perm.state === 'granted';
      }
    } catch {
      alreadyGranted = false;
    }
    if (alreadyGranted) {
      setPhase('ready');
      return;
    }

    setPhase('need-location');
    const ok = await tryLocation();
    if (ok) setPhase('ready');
  }, [deferred, tryLocation]);

  useEffect(() => {
    void resolvePhase();
  }, [resolvePhase]);

  useEffect(() => {
    if (isLocalDevHost() || isPwaStandalone()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setPwaHint('android-prompt');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplay = () => {
      if (isPwaStandalone()) void resolvePhase();
    };
    media.addEventListener?.('change', onDisplay);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      media.removeEventListener?.('change', onDisplay);
    };
  }, [resolvePhase]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (phase === 'need-location' || phase === 'need-pwa') void resolvePhase();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [phase, resolvePhase]);

  async function onInstall() {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === 'accepted') {
        setPwaHint('open-icon');
      }
    } finally {
      setInstalling(false);
    }
  }

  async function onRetryLocation() {
    const ok = await tryLocation();
    if (ok) setPhase('ready');
  }

  if (phase === 'ready') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {insecureHttp ? <InsecureHttpBanner /> : null}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    );
  }

  if (phase === 'checking') {
    return (
      <GateShell title="Preparando o app de campo">
        <p className="mt-3 text-sm text-[var(--muted)]">Verificando instalação e localização…</p>
      </GateShell>
    );
  }

  if (phase === 'need-pwa') {
    return (
      <GateShell title="Instale o Rotas">
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          A localização da rota só é liberada no aplicativo da tela inicial. Não use o navegador em
          aba.
        </p>

        {pwaHint === 'ios' ? (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-brand-900">
            <li>
              Toque em <strong>Compartilhar</strong>.
            </li>
            <li>
              Toque em <strong>Adicionar à Tela de Início</strong>.
            </li>
            <li>
              Feche o Safari e abra o ícone <strong>Rotas</strong>.
            </li>
          </ol>
        ) : null}

        {pwaHint === 'android-manual' ? (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-brand-900">
            <li>
              Abra o menu <strong>⋮</strong> do Chrome.
            </li>
            <li>
              Toque em <strong>Instalar aplicativo</strong> (ou Adicionar à tela inicial).
            </li>
            <li>
              Abra o ícone <strong>Rotas</strong> — não esta aba.
            </li>
          </ol>
        ) : null}

        {pwaHint === 'open-icon' ? (
          <p className="mt-4 text-sm font-semibold text-brand-900">
            Instalado. Feche esta aba e abra o ícone Rotas na tela inicial.
          </p>
        ) : null}

        {pwaHint === 'android-prompt' && deferred ? (
          <button
            type="button"
            disabled={installing}
            onClick={() => void onInstall()}
            className="ops-btn ops-btn-primary mt-5 w-full py-3"
          >
            {installing ? 'Abrindo instalação…' : 'Instalar e usar localização'}
          </button>
        ) : (
          <p className="mt-5 text-xs text-[var(--muted)]">
            Depois de instalar, esta tela some sozinha quando você abrir pelo ícone.
          </p>
        )}
      </GateShell>
    );
  }

  return (
    <GateShell title="Ative a localização">
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        O Rotas pede o GPS na abertura do app para a rota e o mapa da empresa. Toque em{' '}
        <strong className="text-brand-900">Permitir</strong> no aviso do celular.
      </p>
      {locationError ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {locationError}
        </p>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">
          {requestingLocation ? 'Pedindo permissão ao sistema…' : 'Aguardando permissão do GPS.'}
        </p>
      )}
      <button
        type="button"
        disabled={requestingLocation}
        onClick={() => void onRetryLocation()}
        className="ops-btn ops-btn-primary mt-5 w-full py-3"
      >
        {requestingLocation ? 'Solicitando…' : 'Permitir localização agora'}
      </button>
      <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
        Se o aviso não aparecer: Ajustes → Localização → Rotas → Permitir. Depois volte e toque de
        novo.
      </p>
    </GateShell>
  );
}
