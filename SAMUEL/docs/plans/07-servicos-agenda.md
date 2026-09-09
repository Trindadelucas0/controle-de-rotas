# Plano 07 — Ordens de serviço

**Status:** done (2026-08-24)

**Modelo:** Customer → ServiceOrder → Visit → RouteStop → Route

> Nome de arquivo histórico (`07-servicos-agenda`). Agenda = [08-agenda.md](./08-agenda.md). Rotas = [09-rotas.md](./09-rotas.md).

## Escopo entregue

- Tabela `service_orders` + `companies.service_order_seq` (primeira OS = **1001**)
- CRUD OS + cancelamento; prioridade `LOW|NORMAL|HIGH|URGENT`
- Status OS: `OPEN|IN_PROGRESS|COMPLETED|CANCELLED` (sem status de campo)
- Criar OS com primeira visita opcional; `POST /service-orders/:id/visits` para N visitas
- Snapshot de endereço/lat/lng na **visita**
- Bloqueio `VISIT_CUSTOMER_NO_PIN` se cliente sem pin

## Telas

| Rota | Papéis | Objetivo |
| --- | --- | --- |
| `/services` | ADMIN, MANAGER, SUPERVISOR | Lista |
| `/services/new` | ADMIN, MANAGER | Criar (`?customerId=` do mapa) |
| `/services/[id]` | ADMIN/MANAGER write; SUPERVISOR read | Detalhe, visitas, cancelar |

Docs: [screens/services.md](../screens/services.md)

## APIs

| Método | Path | Papéis |
| --- | --- | --- |
| `GET/POST` | `/api/v1/service-orders` | SUPERVISOR só GET |
| `GET/PATCH` | `/api/v1/service-orders/:id` | SUPERVISOR só GET |
| `POST` | `/api/v1/service-orders/:id/cancel` | ADMIN, MANAGER |
| `POST` | `/api/v1/service-orders/:id/visits` | ADMIN, MANAGER |

Módulo: [modules/service-orders.md](../modules/service-orders.md)

## Fora de escopo

Check-in/out, GPS, evidências, Chatwoot, status `IN_ROUTE` na OS.

## Aceite

- Criar OS #1001+ com 2 visitas no mesmo cliente com pin
- SUPERVISOR não cria OS
- Visita sem pin → 422 `VISIT_CUSTOMER_NO_PIN`
