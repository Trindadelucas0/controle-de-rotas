# Plano 09 — Rotas (persistir e publicar)

**Status:** done (2026-08-24)

**Modelo:** paradas = **visitas** (`visitIds`), origem = pin da empresa.

## Escopo entregue

- `POST /routes/preview` com `visitIds` (1–25); OSRM + fallback `straight_line`
- Persistência `routes` + `route_stops`; status inicial `PLANNED`
- Publicar → `PUBLISHED` + visitas `SCHEDULED`/`RESCHEDULED` → `ASSIGNED`
- Funcionário + veículo + data; geometria planejada; `actual*` null
- Tela `/routes` (`RoutesPlanner`); body JSON até 5mb

## Telas

| Rota | Papéis | Objetivo |
| --- | --- | --- |
| `/routes` | Preview: ADMIN/MANAGER/SUPERVISOR; salvar/publicar: ADMIN/MANAGER | Planejar e publicar |
| `/settings/company` | ADMIN | Pin de origem |

Docs: [screens/routes.md](../screens/routes.md)

## APIs

| Método | Path | Papéis |
| --- | --- | --- |
| `POST` | `/api/v1/routes/preview` | ADMIN, MANAGER, SUPERVISOR |
| `GET/POST` | `/api/v1/routes` | POST só ADMIN/MANAGER |
| `GET` | `/api/v1/routes/:id` | ADMIN, MANAGER, SUPERVISOR |
| `POST` | `/api/v1/routes/:id/publish` | ADMIN, MANAGER |

Módulo: [modules/routes.md](../modules/routes.md)

## Fora de escopo

Deep-link Maps/Waze, GPS, execução de campo, VRP premium.

## Aceite

- Preview por visitas (não por `customerIds`)
- Salvar com geometria OSRM
- Publicar atribui funcionário/veículo e marca visitas `ASSIGNED`
- EMPLOYEE sem acesso à API de rotas; SUPERVISOR não publica
