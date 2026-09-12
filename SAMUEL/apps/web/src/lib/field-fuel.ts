export const FUEL_LEVEL_OPTIONS = [
  { value: 'EMPTY', label: 'Vazio' },
  { value: 'QUARTER', label: '1/4' },
  { value: 'HALF', label: '1/2' },
  { value: 'THREE_QUARTERS', label: '3/4' },
  { value: 'FULL', label: 'Cheio' },
] as const;

export type FuelLevel = (typeof FUEL_LEVEL_OPTIONS)[number]['value'];
