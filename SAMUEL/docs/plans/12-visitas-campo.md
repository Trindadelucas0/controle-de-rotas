# Tema 12 — Visitas de campo (check-in / check-out / relatório)

**Status:** done (WP1–WP4 desta entrega)

**Pré-requisitos:** rota iniciada (temas 10–11).

## Entregue

- Check-in manual (“Cheguei — chegada verificada”) com GPS
- Relatório fixo: resultado, observações, fotos, finalizar visita
- Check-out com GPS; `RouteStop` → `COMPLETED`/`FAILED`
- Remarcar próxima visita (nova `ASSIGNED` na mesma OS, sem `RouteStop`)
- Gestor lê relatório em `/services/[id]`

## Telas

| Rota | Papéis | Objetivo | Status |
| --- | --- | --- | --- |
| `/field/visits/[id]` | EMPLOYEE | Check-in + relatório + check-out | done |

## APIs

| Método | Path | Status |
| --- | --- | --- |
| `POST` | `/api/v1/visits/:id/check-in` | done |
| `POST` | `/api/v1/visits/:id/check-out` | done |
| `POST` | `/api/v1/visits/:id/evidence` | done (tema 13 integrado na mesma tela) |
| `GET` | `/api/v1/visits/:id/evidence` | done |
| `GET` | `/api/v1/visits/:id/evidence/:evidenceId/file` | done |
| `PATCH` | `/api/v1/visits/:id` | planejamento (ADMIN/MANAGER) |

## Fora de escopo

- Formulário builder por tipo de serviço
- ADMIN/MANAGER fazendo check-in/out
- Geofence bloqueante no servidor

## Critérios de aceite

- [x] EMPLOYEE só age em visita da própria atribuição (403/404)
- [x] Check-in grava instante + localização
- [x] Check-out grava instante + localização + outcome
- [x] DONE exige ≥1 foto; FOLLOW_UP exige próxima data
- [x] Isolamento por `companyId`; docs + testes

## Como validar

Ver `docs/screens/field-visit.md`.
