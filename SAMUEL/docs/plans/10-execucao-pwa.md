# Tema 10 — Execução PWA (campo)

**Status:** done (2026-08-24)

**Dependência dura:** entregue **junto** com [Tema 11 — Tracking](./11-tracking.md).

**Pré-requisitos:** OS (07) + Agenda (08) + Rota publicada (09).

## Escopo entregue

- PWA de campo: funcionário vê a rota publicada do dia
- **Play / Iniciar rota** → `POST /api/v1/routes/:id/start` → status `IN_PROGRESS` + `startedAt`
- Tracking GPS via HTTP (tema 11) após o Play
- Deep-link Google Maps / Waze por parada
- Telas `/field/my-route` e `/field/tracking-status`

## Telas

| Rota | Papéis | Objetivo |
| --- | --- | --- |
| `/field/my-route` | EMPLOYEE | Rota do dia, Play, GPS HTTP |
| `/field/tracking-status` | EMPLOYEE | Diagnóstico de permissão / sessão |

Docs: [screens/field-my-route.md](../screens/field-my-route.md)

## APIs

| Método | Path | Papéis |
| --- | --- | --- |
| `GET` | `/api/v1/field/my-route` | EMPLOYEE (só a própria) |
| `GET` | `/api/v1/field/tracking-status` | EMPLOYEE |
| `POST` | `/api/v1/routes/:id/start` | EMPLOYEE atribuído |

## Fora de escopo

- Check-in/out e prontuário de visita (12)
- Fotos / object storage (13)
- WebSocket (tracking usa HTTP poll)
- App nativo / GPS em background real

## Aceite

- [x] EMPLOYEE vê só a própria rota PUBLISHED/IN_PROGRESS do dia
- [x] Play exige vínculo User→Employee e rota publicada
- [x] Após Play, GPS envia pontos HTTP (tema 11)
- [x] Empty state sem rota publicada
- [x] Temas 10+11 no mesmo release

## Como validar

1. Seed: `employee@demo.local` / senha do admin seed (vinculado a Employee)
2. Admin publica rota para esse funcionário + veículo
3. Login EMPLOYEE → `/field/my-route` → Play → permitir GPS
4. Admin em `/map` vê pin do veículo (poll `/tracking/live`)
