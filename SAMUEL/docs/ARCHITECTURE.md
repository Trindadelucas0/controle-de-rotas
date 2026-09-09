# Arquitetura — Rotas

## Visão

Rotas é um monorepo **web-first / API-first**:

```
apps/web (Next.js PWA + MapLibre)  --credentials-->  apps/api (NestJS MVC)
                                                         -->  PostgreSQL + PostGIS
                                                         -->  Redis
```

## Stack

| Camada | Tecnologia |
| --- | --- |
| Web | Next.js 15, React, TypeScript, Tailwind, PWA |
| Mapa | **MapLibre GL JS** + raster CARTO Voyager (`NEXT_PUBLIC_CARTO_BASEMAPS_KEY`) |
| Rotas | **OSRM** (`OSRM_URL` no backend) + fallback geodésico |
| API | NestJS MVC + Prisma |
| Banco | **PostGIS** via Docker `postgis/postgis:16-3.5` (host 5433) |
| Cache | Redis 7 |
| Auth | JWT cookies httpOnly + RBAC |

O instalador PostGIS no Windows **não** faz parte do fluxo do Rotas.

## Portas (dev)

| Serviço | URL |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| PostGIS | localhost:5433 |
| Redis | localhost:6379 |

## Multi-tenant

`companyId` no JWT e em todas as queries operacionais.

## Domínio operacional (planejamento)

```
Customer → ServiceOrder → Visit → RouteStop → Route → Employee + Vehicle
```

- **OS** (`service_orders`): demanda do cliente; status `OPEN|IN_PROGRESS|COMPLETED|CANCELLED`; numeração por empresa (`service_order_seq`, a partir de 1001).
- **Visita** (`visits`): agendamento com snapshot de endereço/lat/lng; status de planejamento `SCHEDULED|ASSIGNED|CANCELLED|RESCHEDULED` (enums de execução existem no banco, acionáveis só com check-in — temas 10–12).
- **Rota** (`routes` + `route_stops`): paradas ancoradas em `visitId`; status `DRAFT|PLANNED|ASSIGNED|PUBLISHED|…`; totais e geometria **planejados** (PostGIS `LineString` + JSON `plannedGeometryJson`). Manobras em `plannedStepsJson` (`planned_steps_json`) no dispatch por clientes. Campos `actual*` nascem nulos (preenchidos no tracking).
- **Dispatch por clientes (tema 17):** gestor escolhe clientes + funcionários com login; API cria OS+visitas+N rotas `PUBLISHED`. Preview por visitas permanece.
- **Routing vs navigation:** OSRM (ou fallback reta) desenha A→B→C e grava steps; PWA `/field/navigate` consome geometry + steps (tela cheia). Links Maps/Waze são alternativa na lista, não UX principal.
- **Tracking (temas 10–11 + 17 + 21, HTTP):** Play → `watchPosition` na PWA → fila local → `POST /tracking/points`. Posição atual no Redis (TTL, best-effort); histórico em `tracking_points` (PostGIS, 25 m/15 s ou 5 m/2 s se `recordTrip`). Check-in pode mandar `trailPoints`. Gestor: poll `GET /tracking/live` no mapa. WebSocket = depois.
- **Ops / Context Cards (tema 20):** `GET /ops/snapshot` e `GET /ops/customers/:id` agregam visitas/rotas/live para home e mapa hub. Sem inventar métricas sem check-in.
Body JSON da API aceita até **5mb** (geometria OSRM no `POST /routes`).

## Segurança (resumo)

Segredos só em `.env`; CORS; cookies httpOnly; rate limit login; erros `{ statusCode, code, message }`.

Ver `docs/SECURITY.md` e `docs/DEV.md`.
