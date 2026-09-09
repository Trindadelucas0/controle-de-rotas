const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_APP_TIMEZONE = 'America/Sao_Paulo';

/** Fuso operacional (rotas, campo). Override via APP_TIMEZONE no .env */
export function appTimezone(): string {
  const tz = process.env.APP_TIMEZONE?.trim();
  return tz || DEFAULT_APP_TIMEZONE;
}

/**
 * Dia operacional YYYY-MM-DD.
 * Se `value` vier no formato ISO date, usa direto; senão calcula "hoje" no fuso APP_TIMEZONE.
 */
export function businessDayYmd(value?: string, at: Date = new Date()): string {
  const raw = value?.slice(0, 10);
  if (raw && YMD_RE.test(raw)) return raw;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: appTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Date @db.Date — meia-noite UTC do YYYY-MM-DD operacional. */
export function businessDayUtc(value?: string, at: Date = new Date()): Date {
  const ymd = businessDayYmd(value, at);
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addCalendarDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Instantes UTC do início (inclusivo) e fim (inclusivo) do dia civil `ymd`
 * no fuso `APP_TIMEZONE`.
 */
export function businessDayBoundsUtc(
  value?: string,
  at: Date = new Date(),
): { ymd: string; from: Date; to: Date } {
  const ymd = businessDayYmd(value, at);
  const anchor = Date.parse(`${ymd}T00:00:00.000Z`);
  let lo = anchor - 14 * 3600_000;
  let hi = anchor + 14 * 3600_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (businessDayYmd(undefined, new Date(mid)) < ymd) lo = mid + 1;
    else hi = mid;
  }
  const from = new Date(lo);

  const nextYmd = addCalendarDaysYmd(ymd, 1);
  let endLo = from.getTime();
  let endHi = from.getTime() + 36 * 3600_000;
  while (endLo < endHi) {
    const mid = Math.floor((endLo + endHi) / 2);
    if (businessDayYmd(undefined, new Date(mid)) < nextYmd) endLo = mid + 1;
    else endHi = mid;
  }
  const to = new Date(endLo - 1);
  return { ymd, from, to };
}
