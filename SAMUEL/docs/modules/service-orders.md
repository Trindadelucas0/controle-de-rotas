# Módulo — Serviços / Visitas / Agenda

Tema 07 (UI web). Isolamento por `companyId` do JWT.

## Service orders

- `GET /api/v1/service-orders?q&status&customerId` — ADMIN, MANAGER, SUPERVISOR → `{ serviceOrders }`
- `POST /api/v1/service-orders` — ADMIN, MANAGER (body com `firstVisit` opcional)
- `GET /api/v1/service-orders/:id` — detalhe + visits
- `PATCH /api/v1/service-orders/:id` — ADMIN, MANAGER
- `POST /api/v1/service-orders/:id/cancel` — ADMIN, MANAGER
- `POST /api/v1/service-orders/:id/visits` — ADMIN, MANAGER (`CreateVisitDto`)

Prioridade: `LOW|NORMAL|HIGH|URGENT`. Status: `OPEN|IN_PROGRESS|COMPLETED|CANCELLED`.

Telas: `/services`, `/services/new`, `/services/[id]` — [screens/services.md](../screens/services.md)

## Visits / Agenda

- `GET /api/v1/visits?from&to&employeeId&customerId&serviceOrderId&status` — ADMIN, MANAGER, SUPERVISOR, EMPLOYEE
- `PATCH /api/v1/visits/:id` — ADMIN, MANAGER

Status planejamento: `SCHEDULED|ASSIGNED|CANCELLED|RESCHEDULED` (+ execução: `IN_ROUTE`…).

Tela: `/agenda` — [screens/agenda.md](../screens/agenda.md)

## Checklist ponta solta

- [x] Telas + nav + home
- [x] Docs screens
- [x] Teste API: Cliente → OS → 2 visitas → Agenda (`GET /visits`) → Rotas preview/salvar/publicar
- [x] Bloqueio visita sem pin (`VISIT_CUSTOMER_NO_PIN`)
- [x] SUPERVISOR não cria OS; EMPLOYEE sem `/routes` na nav (RBAC API)
