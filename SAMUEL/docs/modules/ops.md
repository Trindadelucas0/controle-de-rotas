# Módulo — Ops (Context Cards / snapshot / painéis)



Tema 20. Read-model operacional; agregação no servidor; isolamento `companyId`.  

Componentes web: `apps/web/src/components/ops/OperationalSummaryStrip`, `EntityContextPanel`.



## Endpoints — snapshot e context cards



### GET /api/v1/ops/snapshot

- Auth: ADMIN, MANAGER, SUPERVISOR
- Query: `date` opcional `YYYY-MM-DD`
- Resposta: `{ date, timezone, team, visits, routes, live, alerts, meta }`
- `team`: `{ total, inRoute, inService, parado, available, offline, onlineLive }`
  - `total` = ACTIVE com login
  - Invariante: `inRoute + inService + parado + available + offline === total`
  - `inService` = funcionários com visita `IN_PROGRESS` (check-in); `meta.inServiceAvailable = true`
  - Offline = sem GPS Redis (inclui rota COMPLETED / PUBLISHED / ASSIGNED / sem rota)
  - Available = GPS ao vivo sem rota `IN_PROGRESS` (ex.: residual após concluir)
- `live[]`: **um item por** ACTIVE+login — `{ employeeId, employeeName, operational, presence, routeId, routeStatus, vehiclePlate, ... }`
  - `routeStatus`: `IN_PROGRESS` | `COMPLETED` | `PUBLISHED` | `ASSIGNED` | `null` (rota do dia preferindo IN_PROGRESS)


### GET /api/v1/ops/customers/:id



- Auth: ADMIN, MANAGER, SUPERVISOR, EMPLOYEE

- Resposta: `{ customer: CustomerContextCard, nearby: [...] }`



### GET /api/v1/ops/employees/:id · /vehicles/:id · /service-orders/:id

- Auth: conforme entidade (employees/vehicles ADMIN+MANAGER; SO gestores)
- `GET /ops/employees/:id/observations` — ADMIN, MANAGER; dossiê de auditoria (km, desvio de rota, fotos). EMPLOYEE 403.
- `PATCH /ops/employees/:id/observations/:oid` — `{ status: "SEEN" }`
- Alertas do snapshot: `KM_DISCREPANCY`, `OFF_ROUTE`, `ODOMETER_ROLLBACK` (abertas, 7 dias)



- Auth: conforme entidade (employees/vehicles ADMIN+MANAGER; SO gestores)

- Resposta: `{ employee | vehicle | serviceOrder: ContextCard }`



## Endpoints — summaries (KPI strip)



| Path | Papéis | Query |

| --- | --- | --- |

| `GET /ops/customers/summary` | + EMPLOYEE | `date?` |

| `GET /ops/employees/summary` | ADMIN, MANAGER | `date?` |

| `GET /ops/vehicles/summary` | ADMIN, MANAGER | `date?` |

| `GET /ops/service-orders/summary` | ADMIN, MANAGER, SUPERVISOR | — |

| `GET /ops/routes/summary` | ADMIN, MANAGER, SUPERVISOR | `date?` |

| `GET /ops/agenda/summary` | + EMPLOYEE | `date?` |



Sem inventar métricas: `null` / omitir quando não houver dado (ex.: KM real, R$). Check-in preenche `team.inService` / `IN_SERVICE`.



## Endpoints — listas enriquecidas



| Path | Colunas extras |

| --- | --- |

| `GET /ops/customers/list-enriched?q=` | OS abertas, próxima visita |

| `GET /ops/employees/list-enriched?q=&date=` | rota do dia, operacional, placa |

| `GET /ops/vehicles/list-enriched?q=&date=` | rota do dia, motorista |



## Código



- `apps/api/src/modules/ops/ops.service.ts`

- `ops-summaries.ts`, `ops-context.ts`, `ops-enriched.ts`

- Contratos: `context-cards.ts`



## Como testar



1. Login gestor → `/customers` — KPI strip bate com counts da API.

2. Abrir prontuário → painel resumo + timeline de visitas reais.

3. `/routes` aba **Rotas de hoje** — summary + lista do dia.

