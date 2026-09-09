'use client';

/** Faixa visível em HTTP (LAN). Não bloqueia a tela; GPS do browser continua indisponível. */
export function InsecureHttpBanner() {
  return (
    <p
      role="status"
      className="shrink-0 bg-[var(--warn)] px-3 py-2.5 text-center text-sm font-extrabold uppercase tracking-[0.16em] text-[#121212]"
    >
      NÃO ESTÁ EM HTTPS
    </p>
  );
}
