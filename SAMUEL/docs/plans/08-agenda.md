# Plano 08 — Agenda

**Status:** done (2026-08-24)

## Escopo entregue

- `GET /api/v1/visits` com `from`, `to`, `employeeId`, `customerId`, `serviceOrderId`, `status`
- Tela `/agenda` (visão **dia**)
- Mapa: próximas visitas no painel do pin + “Criar serviço”
- EMPLOYEE: só próprias visitas (exige vínculo User→Employee)

## Telas

| Rota | Papéis |
| --- | --- |
| `/agenda` | ADMIN, MANAGER, SUPERVISOR, EMPLOYEE |
| `/map` (painel) | papéis do mapa |

Docs: [screens/agenda.md](../screens/agenda.md), [screens/map.md](../screens/map.md), [modules/visits.md](../modules/visits.md)

## Fora de escopo

Visão semana/mês rica; drag-and-drop; check-in.

## Aceite

- OS com 2 visitas aparece na agenda do dia
- Mapa lista próximas visitas do cliente
