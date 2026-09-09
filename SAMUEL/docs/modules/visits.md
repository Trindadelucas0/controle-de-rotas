# Módulo — Visitas / Agenda

Tema 08 + 12 + 13. Isolamento por `companyId` do JWT.

## Endpoint GET /api/v1/visits

- Auth: ADMIN, MANAGER, SUPERVISOR, EMPLOYEE (JWT cookie)
- Query: `from`, `to` (ISO), `employeeId`, `customerId`, `serviceOrderId`, `status`
- EMPLOYEE: lista só visitas do funcionário vinculado
- Resposta 200: `{ visits: [...] }`

## Endpoint GET /api/v1/visits/:id

- Auth: mesmos papéis; EMPLOYEE só a própria
- Inclui campos de execução: `outcome`, `executionNotes`, `checkedInAt/OutAt`, coords, `evidence[]` (metadados)
- 404 / 403 conforme tenant e atribuição

## Endpoint PATCH /api/v1/visits/:id

- Auth: ADMIN, MANAGER — remarcar/cancelar planejamento

## Endpoint POST /api/v1/visits/:id/check-in

- Auth: só EMPLOYEE da visita
- Body: `{ latitude, longitude, accuracy, trailPoints?: [{ latitude, longitude, recordedAt? }] }`
- `trailPoints`: máx. 500; coords válidas; `recordedAt` nas últimas 24 h; só aplicado se a rota tem `recordTrip` e a visita é do employee (tenant = visita)
- 201 `{ visit, accessPath?: { saved, reason?, pathId?, pointCount? } }` — visita `IN_PROGRESS`; `RouteStop` permanece `PENDING`
- Side effects: se `recordTrip`, merge trail + TrackingPoint → CustomerAccessPath ACTIVE (supersede); audit `ACCESS_PATH_SAVED` / `ACCESS_PATH_FAILED`. Falha da trilha **não** bloqueia o check-in
- 409 `VISIT_ALREADY_CHECKED_IN`

## Endpoint POST /api/v1/visits/:id/check-out

- Auth: só EMPLOYEE da visita
- Body: `{ latitude, longitude, accuracy, outcome, executionNotes?, nextVisit?: { scheduledStart, scheduledEnd? }, trailPoints? }`
- `outcome`: `DONE` | `NO_CONTACT` | `REFUSED` | `FOLLOW_UP`
- Regras: exige check-in; `DONE` exige ≥1 evidência; `FOLLOW_UP` exige `nextVisit.scheduledStart` futuro; observações obrigatórias se outcome ≠ `DONE`
- 201 `{ visit, nextVisit?, accessPath? }` — visita `COMPLETED` ou `FAILED`; `RouteStop` `COMPLETED`/`FAILED`; se `recordTrip` e ainda não há path ACTIVE dessa rota, tenta gravar de novo
- 409 `VISIT_ALREADY_CHECKED_OUT`; 422 `VISIT_CHECKIN_REQUIRED`, `VISIT_EVIDENCE_REQUIRED`, etc.

## Endpoint POST /api/v1/visits/:id/evidence

- Auth: EMPLOYEE da visita
- Multipart: `file` (JPEG/PNG/WebP, máx. 5 MB); opcional `caption`, `latitude`, `longitude`, `accuracy`
- Visita deve estar `IN_PROGRESS` com check-in
- 201 `{ evidence }`; máx. 5 fotos por visita
- Side effects: disco (`STORAGE_DIR`), `visit_evidence`, `visit_events`, audit `VISIT_EVIDENCE_ADDED`

## Endpoint GET /api/v1/visits/:id/evidence

- Auth: gestores da empresa + EMPLOYEE dono
- 200 `{ evidence: [...] }` metadados

## Endpoint GET /api/v1/visits/:id/evidence/:evidenceId/file

- Auth: mesma regra; stream do arquivo (cookies JWT)
- 404 IDOR outro tenant

## Criação (via OS)

- `POST /api/v1/service-orders/:id/visits` — ADMIN, MANAGER

Tela campo: [screens/field-visit.md](../screens/field-visit.md). Plano: [plans/12-visitas-campo.md](../plans/12-visitas-campo.md), [plans/13-evidencias.md](../plans/13-evidencias.md).
