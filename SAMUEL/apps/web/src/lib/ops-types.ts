export type OpsSnapshot = {
  date: string;
  timezone: string;
  team: {
    total: number;
    inRoute: number;
    inService: number;
    parado: number;
    available: number;
    offline: number;
    onlineLive: number;
  };
  visits: {
    planned: number;
    completed: number;
    inProgress: number;
    delayed: number;
    cancelled: number;
  };
  routes: {
    count: number;
    plannedDistanceMeters: number | null;
    actualDistanceMeters: number | null;
    executionPercent: number | null;
  };
  live: {
    employeeId: string;
    employeeName: string;
    operational: 'IN_ROUTE' | 'IN_SERVICE' | 'PARADO' | 'OFFLINE' | 'AVAILABLE' | null;
    presence: 'online' | 'stale' | 'offline';
    currentCustomerName: string | null;
    currentCustomerId: string | null;
    routeId: string | null;
    routeStatus: 'IN_PROGRESS' | 'COMPLETED' | 'PUBLISHED' | 'ASSIGNED' | null;
    vehiclePlate: string | null;
    minutesWithoutGps: number | null;
    latitude: number | null;
    longitude: number | null;
  }[];
  alerts: { code: string; message: string; severity: 'info' | 'warning' | 'critical' }[];
  meta: {
    inServiceAvailable: boolean;
    completedRequiresCheckIn: boolean;
  };
};

export type RoutesSummary = {
  date: string;
  count: number;
  visits: number;
  published: number;
  inProgress: number;
  completed: number;
  assigned: number;
  plannedDistanceMeters: number | null;
  actualDistanceMeters: number | null;
  executionPercent: number | null;
};

export type CustomersSummary = {
  date: string;
  total: number;
  active: number;
  inactive: number;
  withLocation: number;
  withoutLocation: number;
  withVisitToday: number;
  withOpenOs: number;
  withoutVisit30d: number;
};

export type EmployeesSummary = {
  date: string;
  total: number;
  active: number;
  inactive: number;
  onLeave: number;
  suspended: number;
  withLogin: number;
  routesToday: number;
  liveOnline: number;
};

export type VehiclesSummary = {
  date: string;
  total: number;
  available: number;
  inUse: number;
  maintenance: number;
  inactive: number;
  routesToday: number;
  vehiclesOnRoutesToday: number;
  plannedDistanceMeters: number | null;
  liveTrackingCount: number;
};

export type ServiceOrdersSummary = {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  cancelled: number;
};

export type AgendaSummary = {
  date: string;
  total: number;
  planned: number;
  completed: number;
  inProgress: number;
  delayed: number;
  cancelled: number;
};

export type EntityContextCard = {
  summary: Record<string, unknown>;
  statusAtual: string | null;
  metrics: Record<string, number | null>;
  relacionamentos: Record<string, unknown>;
  acoes: { id: string; label: string; href?: string; enabled: boolean }[];
  timeline: {
    at: string;
    type: string;
    title: string;
    detail?: string | null;
    actorName?: string | null;
  }[];
};

export type CustomerOpsContext = {
  customer: {
    summary: {
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
    };
    statusAtual: string | null;
    metrics: {
      openServiceOrders: number;
      visitsTotal: number;
      lastVisitAt: string | null;
      nextVisitAt: string | null;
      lastContactAt: string | null;
    };
    relacionamentos: {
      responsibleEmployee: { id: string; name: string } | null;
      routeId: string | null;
    };
    acoes: { id: string; label: string; href?: string; enabled: boolean }[];
    timeline: {
      at: string;
      type: string;
      title: string;
      detail?: string | null;
      actorName?: string | null;
    }[];
    localizacao: {
      latitude: number | null;
      longitude: number | null;
      label?: string | null;
    } | null;
  };
  nearby: {
    id: string;
    name: string;
    distanceMeters: number;
    city: string | null;
    street: string | null;
    number: string | null;
  }[];
};

export function formatMetersKm(meters: number | null | undefined): string {
  if (meters == null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatOpsDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatOpsDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export const OPS_OPERATIONAL_LABELS: Record<string, string> = {
  IN_ROUTE: 'Em rota',
  IN_SERVICE: 'Em atendimento',
  PARADO: 'Parado',
  OFFLINE: 'Offline',
  AVAILABLE: 'Disponível',
};

export const OPS_ROUTE_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Saiu da rota (concluída)',
  PUBLISHED: 'Rota não iniciada',
  ASSIGNED: 'Rota não iniciada',
};

/** Texto curto para a faixa Equipe / lista ao vivo. */
export function opsEmployeeStatusLine(row: {
  operational: string | null;
  presence: string;
  routeStatus?: string | null;
}): string {
  if (row.routeStatus === 'COMPLETED') return 'Saiu da rota';
  if (row.routeStatus === 'PUBLISHED' || row.routeStatus === 'ASSIGNED') {
    if (row.presence === 'offline') return 'Rota não iniciada';
  }
  if (!row.routeStatus && row.presence === 'offline') return 'Sem rota hoje';
  if (row.operational) {
    return OPS_OPERATIONAL_LABELS[row.operational] ?? row.operational;
  }
  return row.presence === 'online' ? 'Ao vivo' : 'Offline';
}
