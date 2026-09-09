# Tema 18 — Várias rotas no dia + tempo de deslocamento

**Status:** done (2026-08-25)

**Dependências:** tema 17 (rota por clientes + Play/navegação).

## Escopo entregue

1. **Múltiplas rotas por funcionário no mesmo dia** — removido `ROUTE_EMPLOYEE_BUSY` no `dispatch-customers`. Continua valendo só uma rota `IN_PROGRESS` por vez (`ROUTE_ALREADY_ACTIVE`).
2. **Reuso de veículo** — se o funcionário já tem rota ativa no dia com veículo, a nova rota reusa o mesmo; só pede outro `AVAILABLE` se ainda não tiver.
3. **`dayLoad` no preview** — cada assignment traz carga já publicada + totais do dia (km/tempo) para o planejador.
4. **Tempo de deslocamento destacado** — UI `/routes` mostra estimativa OSRM (ruas), soma do dia e aviso sem trânsito/atendimento.
5. **Campo lista N rotas** — `GET /field/my-route` → `{ routes, route }`; Play/Continuar por card.
6. **Concluir rota** — `POST /routes/:id/complete` (`IN_PROGRESS` → `COMPLETED` + `actualDurationSeconds`).

## APIs

| Método | Path | Papéis | Notas |
| --- | --- | --- | --- |
| `POST` | `/api/v1/routes/preview-customers` | ADMIN, MANAGER, SUPERVISOR | Resposta inclui `dayLoad` por assignment |
| `POST` | `/api/v1/routes/dispatch-customers` | ADMIN, MANAGER | Sem `ROUTE_EMPLOYEE_BUSY`; reusa veículo do dia |
| `GET` | `/api/v1/field/my-route` | EMPLOYEE | `{ routes[], route }` — `route` = IN_PROGRESS ou primeira |
| `POST` | `/api/v1/routes/:id/complete` | EMPLOYEE atribuído | Conclui rota em andamento |

## Telas

| Rota | Doc |
| --- | --- |
| `/routes` | [screens/routes.md](../screens/routes.md) |
| `/field/my-route` | [screens/field-my-route.md](../screens/field-my-route.md) |

## Aceite

- [x] Publicar 2ª rota no mesmo dia para o mesmo funcionário não retorna `ROUTE_EMPLOYEE_BUSY`
- [x] Preview mostra tempo da nova + soma do dia quando já há rotas
- [x] Funcionário vê N rotas em Minha rota com km/min
- [x] Play → navegar → Concluir → Play na segunda
- [x] Dois Plays simultâneos → `ROUTE_ALREADY_ACTIVE`

## Fora de escopo

- Unir rotas / acrescentar paradas numa existente
- Google Directions / trânsito ao vivo
- Tempo de atendimento no cliente
- Cancelar rota ao Encerrar navegação

## Docs relacionados

- [modules/routes.md](../modules/routes.md), [API.md](../API.md), [CHANGELOG.md](../CHANGELOG.md)
