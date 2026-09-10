# Módulo — Tracking / Field

Temas 10–11. Isolamento por `companyId` do JWT. Transporte de localização: **somente HTTP**.

## Telas

| Rota | Doc |
| --- | --- |
| `/field/*` (trava PWA+GPS) | [screens/field-pwa-gate.md](../screens/field-pwa-gate.md) |
| `/field/my-route` | [screens/field-my-route.md](../screens/field-my-route.md) |
| `/field/start/[id]` | [screens/field-start-route.md](../screens/field-start-route.md) |
| `/field/navigate` | [screens/field-navigate.md](../screens/field-navigate.md) |
| `/field/visits/[id]` | [screens/field-visit.md](../screens/field-visit.md) |
| `/field/tracking-status` | [screens/field-tracking-status.md](../screens/field-tracking-status.md) |
| `/map` (live) | [screens/map.md](../screens/map.md) |

## GET /api/v1/field/my-route

- Auth: EMPLOYEE
- Query: `date` opcional (`YYYY-MM-DD`) — web envia data local; sem param usa dia operacional (`APP_TIMEZONE`, default `America/Sao_Paulo`)
- Retorna `{ date, routes, route }`:
  - `routes`: `PUBLISHED`/`IN_PROGRESS` do dia do Employee **mais** qualquer `IN_PROGRESS` de outra data (vem primeiro na lista)
  - `route`: a `IN_PROGRESS` se existir (qualquer data), senão a primeira do dia (compatível com navegação)
- Inclui `plannedGeometryJson` e `plannedStepsJson` (navegação GPS)
- 403 se sem vínculo User→Employee

## GET /api/v1/field/tracking-status

- Auth: EMPLOYEE
- `{ trackingActive, route, transport: "http", hint }`

## GET /api/v1/field/vehicles

- Auth: EMPLOYEE
- Query: `routeId` (UUID) — rota do dia para incluir veículo já atribuído mesmo se não `AVAILABLE`
- Retorna `{ vehicles: [{ id, plate, brand, model, status }] }` — veículos `AVAILABLE` da empresa + atribuído à rota
- 403 se sem vínculo User→Employee

## POST /api/v1/routes/:id/start

- Auth: EMPLOYEE atribuído à rota
- Pré: status `PUBLISHED`
- Body: `{ vehicleId, startOdometerKm, startFuelLevel, startNotes?, latitude, longitude }`
  - `startFuelLevel`: `EMPTY` | `QUARTER` | `HALF` | `THREE_QUARTERS` | `FULL`
  - `startOdometerKm` > 0 obrigatório; `latitude`/`longitude` finitos obrigatórios
- Side effects: `IN_PROGRESS` + `startedAt` + campos de checklist + `startLatitude`/`startLongitude`; atualiza `vehicleId` se diferente; **reordena `route_stops.sequence` da mais perto para a mais longe** a partir do GPS enviado; recalcula geometria/manobras/totais planejados e PostGIS `planned_geometry`; atualiza `originLatitude`/`originLongitude` para o ponto de início do funcionário; se `roundtrip`, o traçado volta ao pin da **empresa**
- Validações: veículo da empresa e `AVAILABLE` (ou já atribuído à rota)
- Erro: `ROUTE_ALREADY_ACTIVE` se já houver outra `IN_PROGRESS` (mensagem inclui a data da rota travada; a rota aparece em `GET /field/my-route` mesmo se for de outro dia)
- Abre sessão de tracking (pontos passam a ser aceitos)
- UI: após sucesso no wizard, redirect para `/field/navigate`

## POST /api/v1/routes/:id/complete

- Auth: EMPLOYEE atribuído à rota
- Body: `{ mode: "COMPLETED" | "INCOMPLETE" }`
- Pré: status `IN_PROGRESS`; grava `actualDurationSeconds`; PENDING → SKIPPED conforme regras de 500 m / incompleta
- UI: arrastar em `/field/my-route` e `/field/navigate`
- Erros: `ROUTE_NOT_IN_PROGRESS`, `ROUTE_HAS_PENDING_STOPS`, `ROUTE_HAS_OPEN_VISIT` (422)

## POST /api/v1/tracking/points

- Auth: EMPLOYEE (employee vem do JWT — **não** do body)
- Body: `{ points: [{ routeId, latitude, longitude, accuracy?, speed?, heading?, recordedAt? }] }`
- Requer rota `IN_PROGRESS` do próprio employee
- Side effects:
  - Redis `tracking:current:{companyId}:{employeeId}` **sempre** (TTL 120s) = posição agora
  - PostGIS `tracking_points` **amostrado** (≥25 m ou ≥15 s desde o último persistido)
- Resposta: `{ accepted, persisted }`
- Erro: `TRACKING_ROUTE_NOT_ACTIVE` (422)
- PWA (`field-tracking.ts`):
  - `requestCurrentPosition`: GPS fino (45 s) → se TIMEOUT/UNAVAILABLE, rede/Wi‑Fi (`GEO_COARSE`, 12 s)
  - `startRouteGpsWatch` / `startLocalGpsWatch`: seed `getCurrentPosition(GEO_COARSE)` + `watchPosition` fino **sem timeout**; TIMEOUT/UNAVAILABLE com posição já conhecida são ignorados
  - Amostragem cliente (≥15 m ou ≥5 s) em Minha rota / Navegar; **heartbeat a cada 5 s** reenvia a última posição se o celular estiver parado

## GET /api/v1/tracking/live

- Auth: ADMIN, MANAGER, SUPERVISOR (PLATFORM_ADMIN herda)
- `{ positions: [{ employeeId, employeeName, vehiclePlate, latitude, longitude, presence, ... }] }`
- `presence`: `online` se `updatedAt`/`recordedAt` há ≤30 s; senão `stale` (UI reduz opacidade)
- Fonte: Redis (poll no mapa a cada **~3s**; interpolação do pin 3s); chave some após TTL ~120 s

## GET /api/v1/tracking/history?routeId=

- Auth: ADMIN, MANAGER, SUPERVISOR
- Isolamento: `route.companyId === user.companyId`
- Resposta: `{ routeId, status, points: [{ lat, lng, recordedAt }], geometry: LineString | null }`
- Downsample se >2000 pontos; UI: linha âmbar no `/map` ao pintar rota terminal / deep-link `?routeId=`

## Checklist ponta solta

- [x] Telas field + nav EMPLOYEE (`/field/my-route`, `/field/start/[id]`, `/field/navigate`)
- [x] Pin veículo no mapa gestor
- [x] Seed employee@demo.local vinculado
- [x] Sem WebSocket (HTTP only)
- [x] `plannedStepsJson` disponível no my-route para HUD de manobras
