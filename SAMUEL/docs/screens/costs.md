# PRD UX/Funcional — Custos da frota

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §4.5.

## Tela: `/costs`

### 1. Identidade

- Papéis: ADMIN, MANAGER, SUPERVISOR. EMPLOYEE 403 na API.
- Objetivo: gasto REAL de combustível no período, km real de rotas, custo/km, consumo vs esperado, alertas operacionais.
- Arquivo: `CostsDashboardPage.tsx`

### 2. Componentes

```
PageHeader + seletor de mês
├── cards: Combustível REAL · Km · Custo/km (ou NÃO CALCULÁVEL)
├── consumo por veículo · custo por veículo (clique → ficha / lista de fills)
└── Alertas (não usam a palavra fraude)
```

### 4. KPI

`GET /costs/dashboard`. Cada métrica traz `kind`. Sem par de abastecimentos: consumo não calculável. Sem km real: custo/km não calculável. Sem fills ACTIVE: gasto REAL R$ 0.

### 7. Estados

Skeleton · empty “Ainda não existem dados suficientes…” · error · 403.

### 9. Navegação

Drill: Custos → veículo (`/vehicles/:id`) → abastecimentos (`/fuel?vehicleId=`).
