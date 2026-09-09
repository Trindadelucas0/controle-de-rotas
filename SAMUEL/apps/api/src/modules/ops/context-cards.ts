/**
 * Contrato de Context Cards — 7 objetos principais do Rotas.
 * Read-model compartilhado; campos sem dado = null (nunca inventar métrica).
 * Nesta entrega só `/ops/snapshot` e `/ops/customers/:id` materializam partes do contrato.
 */

export type InteractionType = 'CALL' | 'WHATSAPP' | 'EMAIL' | 'VISIT' | 'NOTE' | 'OTHER';

export type OpsDerivedPresence = 'ONLINE' | 'STALE' | 'OFFLINE' | null;

/** Status operacional derivado (não misturar com Employee.status RH). */
export type OpsDerivedOperational =
  | 'IN_ROUTE'
  | 'IN_SERVICE'
  | 'PARADO'
  | 'OFFLINE'
  | 'AVAILABLE'
  | null;

export type ContextCardBlocks<TSummary, TMetrics = Record<string, number | null>> = {
  summary: TSummary;
  statusAtual: string | null;
  metrics: TMetrics;
  historico: unknown[];
  relacionamentos: Record<string, unknown>;
  acoes: { id: string; label: string; href?: string; enabled: boolean }[];
  timeline: {
    at: string;
    type: InteractionType;
    title: string;
    detail?: string | null;
    actorName?: string | null;
  }[];
  localizacao: {
    latitude: number | null;
    longitude: number | null;
    label?: string | null;
  } | null;
  alertas: { code: string; message: string; severity: 'info' | 'warning' | 'critical' }[];
  permissoes: { role: string; canRead: boolean; canWrite: boolean };
};

export type CompanyContextCard = ContextCardBlocks<{
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
}>;

export type CustomerContextCard = ContextCardBlocks<
  {
    id: string;
    name: string;
    tradeName: string | null;
    document: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    priority: string | null;
    status: string;
  },
  {
    openServiceOrders: number;
    visitsTotal: number;
    lastVisitAt: string | null;
    nextVisitAt: string | null;
    lastContactAt: string | null;
  }
>;

export type EmployeeContextCard = ContextCardBlocks<{
  id: string;
  name: string;
  hrStatus: string;
  presence: OpsDerivedPresence;
  operational: OpsDerivedOperational;
}>;

export type VehicleContextCard = ContextCardBlocks<{
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  status: string;
  avgConsumption: number | null;
  odometerKm: number | null;
}>;

export type ServiceOrderContextCard = ContextCardBlocks<{
  id: string;
  number: number;
  title: string;
  priority: string;
  status: string;
  customerId: string;
  customerName: string;
}>;

export type RouteContextCard = ContextCardBlocks<{
  id: string;
  date: string;
  status: string;
  employeeName: string | null;
  vehiclePlate: string | null;
  plannedDistanceMeters: number | null;
  actualDistanceMeters: number | null;
}>;

export type VisitContextCard = ContextCardBlocks<{
  id: string;
  status: string;
  scheduledStart: string;
  customerName: string;
  employeeName: string | null;
}>;
