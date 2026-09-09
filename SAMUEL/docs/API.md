# API ? Rotas `/api/v1`

Erro padr?o:

```json
{ "statusCode": 401, "code": "AUTH_INVALID_CREDENTIALS", "message": "E-mail ou senha inv?lidos." }
```

Escopo de neg?cio: sempre `companyId` do JWT.

Body JSON: limite **5mb** (geometria OSRM em `POST /routes`).

---

## Health

- `GET /health` ? `{ status, db, redis, postgis }`

## Auth

- `POST /auth/login` ? `refresh` ? `logout` ? `GET /auth/me`
- `POST /auth/forgot-password` ? `reset-password` ? `PATCH /auth/change-password`
- Seed: `admin@demo.local` / `ChangeMe123!`

## Companies / Users / Employees / Customers / Vehicles

Ver m?dulos CRM. Empresa e clientes com lat/lng e `locationStatus` (OK quando pin presente).

### Employees (login de campo)

Detalhes: [modules/employees.md](modules/employees.md). UI: `/employees`.

- `POST /employees` — body inclui `email` + `password` (mín. 8); cria User `EMPLOYEE` + vínculo
- `PATCH /employees/:id` — sem `userId` exige `email` + `password` (cria acesso); já com login, senha só em Usuários
- Erros: `USER_EMAIL_EXISTS` (409), `EMPLOYEE_ALREADY_HAS_LOGIN`, `EMPLOYEE_LOGIN_EMAIL_REQUIRED`, `EMPLOYEE_LOGIN_REQUIRED`

## Lookups (ADMIN, MANAGER, SUPERVISOR, EMPLOYEE)

Proxy BrasilAPI + Nominatim ? detalhes em [modules/lookups.md](modules/lookups.md).

- `GET /lookups/cnpj/:cnpj` ? 14 d?gitos
- `GET /lookups/cep/:cep` ? 8 d?gitos
- `GET /lookups/address?q=` ? min 3 chars, at? 5 sugest?es com lat/lng

## Map (ADMIN, MANAGER, SUPERVISOR)

- `GET /map/customers?q&status` ? pins
- `GET /map/customers/nearby?lat&lng&radiusMeters` ? PostGIS `ST_DWithin`
- `POST /customers/:id/geocode` — Nominatim (ADMIN/MANAGER)
- `POST /customers/:id/landmarks` — `{ type: PORTEIRA|PONTE|BIFURCACAO|ESTRADA_RUIM, latitude, longitude, note? }` (ADMIN/MANAGER; EMPLOYEE só se rota IN_PROGRESS desse cliente)
- `GET /customers/:id/access` — `{ accessPath, landmarks }` (ADMIN/MANAGER)
- Check-in visita (`POST /visits/:id/check-in`): se a rota tem `recordTrip`, merge `trailPoints` (máx. 500, 24 h) + TrackingPoint → `CustomerAccessPath` ACTIVE; resposta `{ visit, accessPath: { saved, reason? } }`; check-out tenta de novo se ainda não houver path dessa rota

UI: MapLibre GL JS + OpenStreetMap em `/map`.

## Service orders (ADMIN, MANAGER write; SUPERVISOR read)

Detalhes: [modules/service-orders.md](modules/service-orders.md). UI: `/services`.

- `GET|POST /service-orders`
- `GET|PATCH /service-orders/:id`
- `POST /service-orders/:id/cancel`
- `POST /service-orders/:id/visits`

## Visits / Agenda

Detalhes: [modules/visits.md](modules/visits.md). UI: `/agenda`.

- `GET /visits?from&to&employeeId&customerId&status`
- `GET|PATCH /visits/:id`
- `POST /visits/:id/check-in` — EMPLOYEE; body `{ latitude, longitude, accuracy, trailPoints? }`; 201 `{ visit, accessPath? }`; 409 `VISIT_ALREADY_CHECKED_IN`
- `POST /visits/:id/check-out` — EMPLOYEE; body `{ latitude, longitude, accuracy, outcome, executionNotes?, nextVisit?, trailPoints? }`; 409 `VISIT_ALREADY_CHECKED_OUT`
- `POST /visits/:id/evidence` — EMPLOYEE; multipart `file`; visita `IN_PROGRESS`
- `GET /visits/:id/evidence` — metadados
- `GET /visits/:id/evidence/:evidenceId/file` — download autenticado
- Storage local: env `STORAGE_DIR` (default `apps/api/storage`)
- Erro ao agendar sem pin: `VISIT_CUSTOMER_NO_PIN` (422)

## Routes

Detalhes: [modules/routes.md](modules/routes.md). UI: `/routes` (modos Clientes + Visitas).

- `POST /routes/preview` ? `{ visitIds, roundtrip? }`
- `POST /routes/preview-customers` — `{ customerIds, employeeIds, roundtrip?, date?, recordTrip?, originMode? }` (`originMode`: `EMPLOYEE_LAST` padrão ou `COMPANY`; 1–25 clientes, 1–8 funcionários com login; sem persistir; inclui `dayLoad` + `startOrigin`); ordem das paradas = **mais perto → mais longe** da origem escolhida; `recordTrip: true` exige exatamente 1 cliente
- `POST /routes/dispatch-customers` — mesmo body; cria OS+visitas+rotas `PUBLISHED` + `plannedStepsJson` + `recordTrip` (ADMIN/MANAGER); **permite várias rotas no dia**; reusa veículo do dia; `origin*` = início do traçado (funcionário ou E); roundtrip volta ao E; se cliente tem `CustomerAccessPath` ACTIVE e a rota tem 1 parada, usa geometria gravada **recortada a partir da origem** (não a trilha inteira)
- `GET /routes`, `POST /routes` (`recordTrip?`), `GET /routes/:id`, `POST /routes/:id/publish`
- `POST /routes/:id/start` — EMPLOYEE atribuído → `IN_PROGRESS`; body wizard: `vehicleId`, `startOdometerKm`, `startFuelLevel`, `latitude`, `longitude`, `startNotes?`; grava checklist + GPS inicial; **reordena paradas da mais perto para a mais longe** (GPS do celular) e recalcula geometria/manobras (trilha ACTIVE recortada no GPS); roundtrip volta ao E; erro `ROUTE_ALREADY_ACTIVE` se já houver outra
- `POST /routes/:id/reroute` — EMPLOYEE atribuído + rota `IN_PROGRESS`; body `{ latitude, longitude, reorderRemaining }`; recalcula geometry/steps a partir do GPS (mesmo recorte de trilha); `reorderRemaining: true` = pendentes mais perto→mais longe; rate limit Redis 30/min (mesmo preview)
- `POST /routes/:id/complete` — EMPLOYEE atribuído → `COMPLETED` + `actualDurationSeconds`
- Motor: OSRM (`OSRM_URL`) + fallback + access path ACTIVE (1 parada); rate limit Redis 30/min no preview/dispatch-customers/reroute
- Dia operacional: `APP_TIMEZONE` (default `America/Sao_Paulo`) quando `date` omitido no body
- Erros frequentes: `CUSTOMER_NO_PIN`, `EMPLOYEE_LOGIN_REQUIRED`, `ROUTE_NOT_ENOUGH_VEHICLES`, `ROUTE_ALREADY_ACTIVE`, `ROUTE_NOT_IN_PROGRESS`, `ROUTE_RATE_LIMITED`, `ROUTE_RECORD_TRIP_SINGLE_CUSTOMER`

## Field / Tracking (EMPLOYEE envia; gestores leem)

Detalhes: [modules/tracking.md](modules/tracking.md). UI: `/field/my-route`, `/field/start/[id]`, `/field/navigate`, `/map`.

- `GET /field/vehicles?routeId=` ? ve?culos `AVAILABLE` + atribu?do ? rota (EMPLOYEE)
- `GET /field/my-route` — `{ date, routes, route }` (query `?date=` opcional; dia operacional `APP_TIMEZONE`; inclui `IN_PROGRESS` de outro dia; poll 15s na PWA; cada rota traz `recordTrip`; cada parada pode trazer `accessPath` ACTIVE e `landmarks[]`)
- `GET /field/tracking-status`
- `POST /tracking/points` — body `{ points: [{ routeId, latitude, longitude, accuracy?, speed?, heading?, recordedAt? }] }` (máx. 50). Histórico: 25 m/15 s; se `recordTrip`, 5 m/2 s. Redis live é best-effort e não bloqueia o PostGIS.
  - JWT → employee (não aceita employeeId no body)
  - exige rota `IN_PROGRESS` do próprio funcionário
  - Redis = posição atual (sempre); PostGIS = histórico amostrado (~25 m ou ~15 s)
  - resposta `{ accepted, persisted }`
- `GET /tracking/live` — posições atuais (Redis); poll no mapa do gestor
- PWA: seed coarse + `watchPosition` (sem timeout) + amostragem no cliente (≥15 m ou ≥5 s; com `recordTrip` ≥5 m ou ≥2 s) via `startRouteGpsWatch`; `requestCurrentPosition` progressivo (fino → rede)
- Sem WebSocket neste release (mapa usa poll HTTP)

## Ops / Context Cards + Pain?is

Detalhes: [modules/ops.md](modules/ops.md). UI: `/`, `/map`, listas Recursos, `/routes` (aba Hoje).

- `GET /ops/snapshot?date=` ? equipe, visitas, rotas, live, alertas (gestores)
- Summaries: `/ops/customers|employees|vehicles|service-orders|routes|agenda/summary`
- Context: `/ops/customers|employees|vehicles|service-orders/:id`
- Listas enriquecidas: `/ops/customers|employees|vehicles/list-enriched`
- EMPLOYEE: summaries clientes/agenda, context cliente, lista clientes enriquecida
- Sem inventar m?tricas: `null` / "?" quando n?o h? check-in, KM real ou custo R$
