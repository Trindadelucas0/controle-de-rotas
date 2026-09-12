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
- Query: `routeId` (UUID) — inclui o veículo da rota mesmo se o status não for AVAILABLE
- Retorna `{ vehicles: [{ id, plate, brand, model, status, odometerKm, lastFuelLevel, inUseByOther }] }`
- Omite veículos com outra rota `IN_PROGRESS` e status `MAINTENANCE`/`INACTIVE`
- 403 se sem vínculo User→Employee

## POST /api/v1/routes/:id/start

- Auth: EMPLOYEE atribuído à rota
- Pré: status `PUBLISHED`
- Body: multipart `file` (foto JPEG/PNG/WebP ≤5 MB) + `vehicleId`, `startOdometerKm`, `startFuelLevel`, `startNotes?`, `latitude`, `longitude`
  - `startFuelLevel`: `EMPTY` | `QUARTER` | `HALF` | `THREE_QUARTERS` | `FULL`
  - `startOdometerKm` > 0 obrigatório; GPS finito obrigatório; foto obrigatória
- Side effects: `IN_PROGRESS` + checklist + evidência `START_ODOMETER`; veículo `IN_USE`; lock contra outra `IN_PROGRESS` no mesmo `vehicleId` (409 `VEHICLE_IN_USE`); reordena paradas; se km inicial < último km do veículo (tol. 1 km) cria `ODOMETER_ROLLBACK` (não bloqueia); salto > 50 km cria `ODOMETER_GAP`
- Erro: `ROUTE_ALREADY_ACTIVE`, `ROUTE_EVIDENCE_REQUIRED`, `VEHICLE_IN_USE`, `VEHICLE_NOT_AVAILABLE`
- UI: após sucesso no wizard, redirect para `/field/navigate`

## POST /api/v1/field/routes/:id/complete

- Auth: EMPLOYEE atribuído **ou** ADMIN/MANAGER (PLATFORM_ADMIN herda ADMIN)
- Mesmas regras que `POST /routes/:id/complete`
- UI: arrastar em `/field/my-route` e `/field/navigate` (km final, combustível e foto)

## POST /api/v1/routes/:id/complete

- Auth: EMPLOYEE atribuído à rota **ou** ADMIN/MANAGER da empresa
- Campo (EMPLOYEE): multipart `mode`, `endOdometerKm`, `endFuelLevel`, `file`
- Escritório: JSON `{ mode }` basta (foto/km opcionais)
- Pré: status `IN_PROGRESS`; grava `actualDurationSeconds`, `actualDistanceMeters`, `endOdometerKm`; PENDING → SKIPPED; libera veículo `AVAILABLE`; atualiza `Vehicle.odometerKm` / `lastFuelLevel`
- Discrepância km (delta > max(planejado×1,5, planejado+5 km)) → observação `KM_DISCREPANCY` no funcionário; **não** entra no JSON do campo
- Erros: `ROUTE_NOT_IN_PROGRESS`, `ROUTE_HAS_PENDING_STOPS`, `ROUTE_HAS_OPEN_VISIT`, `ROUTE_EVIDENCE_REQUIRED`, `END_ODOMETER_BEFORE_START` (422)

## GET /api/v1/routes/:id/evidence/:evidenceId/file

- Auth: escritório da empresa **ou** EMPLOYEE dono da rota
- Stream da foto do odômetro; outro tenant 404

## POST /api/v1/tracking/points

- Auth: EMPLOYEE (employee vem do JWT — **não** do body)
- Body: `{ points: [{ routeId, latitude, longitude, accuracy?, speed?, heading?, recordedAt? }] }`
- Requer rota `IN_PROGRESS` do próprio employee
- Side effects:
  - Redis `tracking:current:{companyId}:{employeeId}` **sempre** (TTL 120s) = posição agora
  - PostGIS `tracking_points` **amostrado** (≥25 m ou ≥15 s desde o último persistido)
  - Off-route admin: se GPS > **500 m** da linha planejada por ≥ **60 s** contínuos, upsert observação `OFF_ROUTE` (uma por rota; o campo não vê alerta)
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
