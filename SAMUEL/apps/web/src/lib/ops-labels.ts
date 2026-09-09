export const OS_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const OS_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
};

export const VISIT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendada',
  ASSIGNED: 'Atribuída',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Remarcada',
  IN_ROUTE: 'Em rota',
  ARRIVED: 'Chegou',
  IN_PROGRESS: 'Em atendimento',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou',
};

export const VISIT_OUTCOME_LABELS: Record<string, string> = {
  DONE: 'Realizada',
  NO_CONTACT: 'Cliente ausente',
  REFUSED: 'Sem interesse',
  FOLLOW_UP: 'Precisa retorno',
};

export function labelOf(map: Record<string, string>, value: string): string {
  return map[value] || value;
}

/** `datetime-local` value from ISO / Date. */
export function toDatetimeLocalValue(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO from `datetime-local` (local timezone). */
export function fromDatetimeLocalValue(local: string): string | undefined {
  if (!local.trim()) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function toDateInputValue(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayRangeIso(dateYmd: string): { from: string; to: string } {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function addDaysYmd(dateYmd: string, days: number): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateInputValue(dt);
}
