# Módulo — Rotas

Rotas por **visitas** (fluxo legado do planejador) e por **clientes** (dispatch que cria OS+visitas no servidor). Paradas sempre ancoradas em `visitId`. No planejador por clientes, o início do km/tempo é a origem escolhida (**F** última loc. ou **E** empresa); roundtrip volta ao pin da empresa. Números = paradas.

Campo novo no modelo `routes`: `planned_steps_json` (`plannedStepsJson`) — manobras OSRM (`steps=true`) ou fallback linha reta, gravadas no publish por clientes para a PWA não depender do OSRM no Play.

Também: `record_trip` (`recordTrip`) — quando true, densifica GPS (~5 m / 2 s no servidor) na navegação, enfileira pontos no celular e no check-in/check-out consolida trilha em `CustomerAccessPath`. Unique parcial: um ACTIVE por (empresa, cliente). Modelos `customer_access_paths` e `customer_landmarks` (tema 21 / v0.15.3).

## Telas

| Rota | Doc |
| --- | --- |
| `/routes` | [screens/routes.md](../screens/routes.md) |
| `/field/my-route` | [screens/field-my-route.md](../screens/field-my-route.md) |
| `/field/navigate` | [screens/field-navigate.md](../screens/field-navigate.md) |
| `/field/visits/[id]` | [screens/field-visit.md](../screens/field-visit.md) |

Plano: [plans/17-rota-clientes.md](../plans/17-rota-clientes.md), [plans/18-multi-rotas-dia.md](../plans/18-multi-rotas-dia.md), [plans/21-gravar-viagem-acesso.md](../plans/21-gravar-viagem-acesso.md).

---

## Endpoint POST /api/v1/customers/:id/landmarks

- Auth: ADMIN, MANAGER, EMPLOYEE (JWT)
- Rate limit: N/A (validação de ownership no servidor)
- Body:

```json
{
  "type": "PORTEIRA",
  "latitude": -23.5,
  "longitude": -46.6,
  "note": "opcional até 300 chars"
}
```

- EMPLOYEE: só se existe `RouteStop` do cliente em rota `IN_PROGRESS` do próprio `employeeId` **e** essa rota tem `recordTrip: true` (Gravar viagem)
- Side effects: cria `CustomerLandmark` + Point PostGIS (trigger)

### Respostas

**201/200** — `{ landmark }`

**403** — `LANDMARK_FORBIDDEN` / `LANDMARK_RECORD_TRIP_REQUIRED` / `AUTH_FORBIDDEN`

**404** — `CUSTOMER_NOT_FOUND`

**422** — `LANDMARK_INVALID_COORDS`

### Como testar

Campo em navegação **com Gravar viagem** + GPS → botão Porteira; gestor em `/map` (pin ou rota pintada) vê o marco. Sem Gravar viagem os botões não aparecem e o POST do EMPLOYEE retorna 403.

---

## Endpoint GET /api/v1/customers/:id/access

- Auth: ADMIN, MANAGER
- Resposta: `{ accessPath: { id, geometryJson, distanceMeters, status } | null, landmarks: [...] }`
- Como testar: após check-in com Gravar viagem, abrir cliente no mapa

---

## Endpoint POST /api/v1/routes/preview

- Auth: ADMIN, MANAGER, SUPERVISOR (JWT)
- Rate limit: 30 req/min por usuário (`rl:routes:preview:{userId}` no Redis)
- Body:

```json
{
  "visitIds": ["uuid", "uuid"],
  "roundtrip": true
}
```

- `visitIds`: 1–25 UUIDs, sem duplicata, status SCHEDULED|RESCHEDULED|ASSIGNED, com lat/lng
- `roundtrip`: default `true`

### Respostas

**200** — stops usam `visitId` + `serviceOrderNumber` / `serviceOrderTitle`:

```json
{
  "origin": { "name": "Demo", "latitude": -23.5, "longitude": -46.6, "address": "…" },
  "stops": [
    {
      "sequence": 1,
      "visitId": "…",
      "customerId": "…",
      "name": "Cliente A",
      "serviceOrderNumber": 12,
      "serviceOrderTitle": "Manutenção",
      "city": "São Paulo",
      "street": "Rua X",
      "number": "10",
      "latitude": -23.55,
      "longitude": -46.63,
      "distanceMeters": 1200,
      "durationSeconds": 180
    }
  ],
  "totals": { "distanceMeters": 5000, "durationSeconds": 900, "distanceKm": 5.0 },
  "geometry": { "type": "LineString", "coordinates": [[-46.6, -23.5], [-46.63, -23.55]] },
  "quality": "road",
  "roundtrip": true
}
```

---

## Endpoint POST /api/v1/routes/preview-customers

- Auth: ADMIN, MANAGER, SUPERVISOR
- Rate limit: mesmo bucket Redis do preview (30/min)
- Body / Query:

```json
{
  "customerIds": ["uuid"],
  "employeeIds": ["uuid"],
  "roundtrip": true,
  "recordTrip": false,
  "originMode": "EMPLOYEE_LAST",
  "date": "2026-08-25"
}
```

- `customerIds`: 1–25, únicos, ACTIVE, mesma empresa, **com pin**; `recordTrip: true` exige ≥1 cliente (aplica a todas as rotas do lote)
- `employeeIds`: 1–8, ≤ clientes, ACTIVE, **com `userId`**
- `originMode`: `EMPLOYEE_LAST` (padrão) ou `COMPANY`. Última loc. = Redis live (120 s) senão último `tracking_points` da **mesma empresa**; sem ponto → pin E (`company_fallback`)
- `recordTrip`: default false; grava trilha no check-in de cada cliente
- Não cria OS/visita/rota
- Split: carga balanceada (±1), proximidade a partir da origem escolhida, clusters por ângulo se todos no E
- Ordem das paradas: **mais perto → mais longe** a partir da origem escolhida; traçado OSRM `/route` (ordem fixa), **CustomerAccessPath ACTIVE** (1 parada, geometria recortada a partir da origem GPS — não a trilha inteira da gravação) ou linha reta; roundtrip volta ao pin da empresa (**E**)
- Cada assignment inclui `startOrigin`: `{ source: live|tracking_history|company|company_fallback, name, latitude, longitude, recordedAt }`
- Play (`POST /routes/:id/start`) e `reroute`: mesma regra com o GPS real do celular; HUD de navegação calcula Tempo/ETA com a velocidade ao vivo
- Erro: `ROUTE_RECORD_TRIP_NO_CUSTOMERS` (só se `recordTrip` sem clientes)

### Respostas

**200:**

```json
{
  "origin": { "name": "Demo", "latitude": -23.5, "longitude": -46.6, "address": "…" },
  "originMode": "EMPLOYEE_LAST",
  "date": "2026-08-25",
  "roundtrip": true,
  "assignments": [
    {
      "employeeId": "…",
      "employeeName": "Ana",
      "vehicleId": "…" ,
      "startOrigin": {
        "source": "live",
        "name": "Ana",
        "latitude": -23.4,
        "longitude": -46.5,
        "recordedAt": "2026-09-09T12:00:00.000Z"
      },
      "stops": [
        {
          "sequence": 1,
          "customerId": "…",
          "name": "Cliente A",
          "city": "São Paulo",
          "street": "Rua X",
          "number": "10",
          "latitude": -23.55,
          "longitude": -46.63,
          "distanceMeters": 1200,
          "durationSeconds": 180
        }
      ],
      "totals": { "distanceMeters": 5000, "durationSeconds": 900, "distanceKm": 5.0 },
      "dayLoad": {
        "existingRouteCount": 1,
        "existingDistanceMeters": 3000,
        "existingDurationSeconds": 600,
        "dayDistanceMeters": 8000,
        "dayDurationSeconds": 1500,
        "dayDistanceKm": 8.0
      },
      "geometry": { "type": "LineString", "coordinates": [[-46.6, -23.5]] },
      "quality": "road"
    }
  ]
}
```

- `dayLoad`: rotas `PUBLISHED`/`IN_PROGRESS` já existentes do funcionário na data + soma com a nova assignment
- Veículo no preview: reusa o da rota já publicada no dia, se houver

**4xx (exemplos):** `CUSTOMER_NO_PIN` (422), `EMPLOYEE_LOGIN_REQUIRED` (422), `ROUTE_DUPLICATE_CUSTOMERS`, `ROUTE_DUPLICATE_EMPLOYEES`, `ROUTE_TOO_MANY_STOPS`, `ROUTE_TOO_MANY_EMPLOYEES`, `ROUTE_CUSTOMER_NOT_FOUND`, `EMPLOYEE_NOT_FOUND` (404), `EMPLOYEE_NOT_ACTIVE`, `COMPANY_ORIGIN_MISSING`. 404 de rota inexistente: JSON `{ "statusCode": 404, "code": "NOT_FOUND", "message": "Recurso não encontrado." }` (nunca HTML Express).

- Side effects: só Redis rate limit
- Como testar: `/routes` modo Clientes com 2+ clientes e funcionários com login

---

## Endpoint POST /api/v1/routes/dispatch-customers

- Auth: ADMIN, MANAGER
- Rate limit: mesmo preview (30/min)
- Body: igual a `preview-customers` (inclui `originMode`)
- Cookies: N/A

### Respostas

**200** — `{ origin, originMode, date, roundtrip, routes: [...] }` (cada rota via `getOne`; `origin*` da rota = início do traçado)

**422:** `ROUTE_NOT_ENOUGH_VEHICLES` (só se o funcionário ainda não tiver veículo no dia e faltar AVAILABLE), demais do preview

- Side effects (transação):
  - Por parada: OS `IN_PROGRESS` título `Rota {date}`, visita `ASSIGNED` com snapshot de endereço
  - Rota já `PUBLISHED` + `plannedGeometryJson` + **`plannedStepsJson`** + PostGIS `planned_geometry`
  - Veículo: reusa o da rota ativa do dia; senão atribui um `AVAILABLE` (ordem por placa)
  - Permite **várias rotas** `PUBLISHED` no mesmo dia para o mesmo funcionário (sem `ROUTE_EMPLOYEE_BUSY`)
- Como testar: publicar no planner → publicar outra no mesmo dia → funcionário vê ambas em `/field/my-route`

Formato interno de `plannedStepsJson`:

```json
{
  "provider": "osrm",
  "roundtrip": true,
  "legs": [
    {
      "distanceMeters": 1200,
      "durationSeconds": 180,
      "steps": [
        {
          "distanceMeters": 100,
          "durationSeconds": 20,
          "name": "Av. Exemplo",
          "ref": null,
          "lanes": [
            { "indications": ["left"], "valid": true },
            { "indications": ["straight"], "valid": false }
          ],
          "maneuver": { "type": "turn", "modifier": "left", "location": [-46.63, -23.55] }
        }
      ]
    }
  ]
}
```

- `ref` / `lanes`: preenchidos no publish/reroute OSRM (`compactOsrmSteps` — `lanes` = 1ª intersection do step). Ausentes ou `null` em JSON antigo / linha reta.

---

## Endpoint POST /api/v1/routes

- Auth: ADMIN, MANAGER
- Body: `{ date, employeeId, vehicleId, stops: [{ visitId, sequence, distanceMeters?, durationSeconds? }], roundtrip?, recordTrip?, plannedDistanceMeters?, plannedDurationSeconds?, geometry?, quality? }`
- Cria rota `PLANNED`; `recordTrip` exige 1 visita

## Endpoint PATCH /api/v1/routes/:id

- Auth: ADMIN, MANAGER
- Pré: status `PLANNED` | `PUBLISHED` (antes do Play); senão `422 ROUTE_NOT_EDITABLE`
- Body: mesmo shape de `POST /routes` (`date`, `employeeId`, `vehicleId`, `stops`, `roundtrip?`, `recordTrip?`, métricas/geometria)
- Side effects: substitui paradas; visitas removidas `ASSIGNED` → `SCHEDULED` + `employeeId` null; se rota `PUBLISHED`, visitas finais → `ASSIGNED` com o funcionário da rota; atualiza PostGIS `planned_geometry`
- Visitas novas não podem estar em outra rota ativa (`ROUTE_VISIT_ALREADY_ASSIGNED`; a própria rota é ignorada)
- Respostas: **200** `{ route }` | **404** `ROUTE_NOT_FOUND` | **422** `ROUTE_NOT_EDITABLE` / `ROUTE_DUPLICATE_VISITS` / …
- Como testar: Rotas de hoje → Gerir → alterar funcionário/paradas → Salvar

## Endpoint POST /api/v1/routes/:id/cancel

- Auth: ADMIN, MANAGER
- Pré: status `PLANNED` | `PUBLISHED`; senão `422 ROUTE_NOT_EDITABLE`
- Body: vazio
- Side effects: visitas `ASSIGNED` das paradas → `SCHEDULED` + limpa `employeeId`; apaga `RouteStop`s (`visitId` unique); `status = CANCELLED`
- Respostas: **200** `{ route }` (stops vazios) | **404** | **422** `ROUTE_NOT_EDITABLE`
- Como testar: Rotas de hoje → Gerir → Cancelar rota → visitas livres no planejador

## Endpoint POST /api/v1/routes/:id/publish

- Auth: ADMIN, MANAGER
- Publica e marca visitas SCHEDULED/RESCHEDULED como ASSIGNED

## Endpoint POST /api/v1/routes/:id/start

- Auth: EMPLOYEE atribuído
- Pré: `PUBLISHED` → `IN_PROGRESS` + `startedAt`
- Erro: `ROUTE_ALREADY_ACTIVE` se já houver outra `IN_PROGRESS` (qualquer data; mensagem cita dd/mm/aaaa; Minha rota lista essa rota para concluir)

## Endpoint POST /api/v1/routes/:id/reroute

- Auth: EMPLOYEE atribuído
- Rate limit: 30 req/min por usuário (`rl:routes:preview:{userId}` no Redis)
- Pré: rota `IN_PROGRESS`
- Body:

```json
{
  "latitude": -15.83,
  "longitude": -48.06,
  "reorderRemaining": true
}
```

- `reorderRemaining: true` — paradas a mais de ~80 m do GPS ordenadas **mais perto → mais longe**; `false` — mantém a ordem das pendentes
- Paradas a ≤80 m do GPS saem do traçado (ficam no fim da sequência)
- Persiste: `plannedGeometryJson`, `plannedStepsJson`, totais, `originLatitude/Longitude` (posição atual). **Não** altera `startLatitude/startLongitude`
- Respostas:
  - **200** — `{ route }` (mesmo shape de `getOne`)
  - **422** `ROUTE_NOT_IN_PROGRESS` / `ROUTE_REROUTE_GPS_REQUIRED`
  - **403** `ROUTE_NOT_ASSIGNED` / `ROUTE_REROUTE_EMPLOYEE_ONLY`
  - **429** `ROUTE_RATE_LIMITED`
- Side effects: OSRM `/route` (ou linha reta); PostGIS `planned_geometry`; sequência das paradas
- Como testar: navegar com GPS longe da polyline → banner Recalculando → linha nasce no carro

## Endpoint POST /api/v1/routes/:id/complete

- Auth: EMPLOYEE atribuído
- Body: `{ mode: "COMPLETED" | "INCOMPLETE" }`
- Pré: `IN_PROGRESS`; visita `ARRIVED`/`IN_PROGRESS` → `ROUTE_HAS_OPEN_VISIT`
- Regra 500 m: restante planejado das paradas `PENDING` ≤ 500 m (ou 0 pendentes) → pode `COMPLETED` (PENDING → `SKIPPED`); acima de 500 m só `INCOMPLETE`. Se `mode=INCOMPLETE` com ≤500 m, API promove para `COMPLETED`.
- Respostas:
  - **200** — `{ route }` (mesmo shape de `getOne`); status `COMPLETED` ou `INCOMPLETE`
  - **422** `ROUTE_NOT_IN_PROGRESS` / `ROUTE_HAS_PENDING_STOPS` / `ROUTE_HAS_OPEN_VISIT`
  - **403** `ROUTE_NOT_ASSIGNED` / `ROUTE_COMPLETE_EMPLOYEE_ONLY`
- Side effects: status terminal; libera Play em outra rota; gestor vê incompletas + trilha em `/map?routeId=`
- UI: arrastar em `/field/my-route` e `/field/navigate`
- Como testar: Play → concluir com pendentes longe → `INCOMPLETE`; ≤500 m ou tudo feito → `COMPLETED`
