# Tema 20 — Painéis operacionais (CRUD → painel)

**Status:** done

**Objetivo:** Cada entidade do grafo operacional deixa de ser CRUD puro e passa a ser painel com KPI strip (API real), filtros, registros enriquecidos, detalhe com resumo/timeline/relacionamentos.

## Regra de produto

Nenhuma tela operacional nova como CRUD puro. Deve responder: o que é, status, o que aconteceu, o que vem, responsável, o que fazer agora.

## Arquitetura de informação (4 áreas)

| Área | Telas |
| --- | --- |
| Operação | Início, Mapa, Agenda, Serviços, Rotas |
| Recursos | Clientes, Funcionários, Veículos |
| Execução | Minha rota, Iniciar rota, Navegar, Status GPS |
| Administração | Empresa, Usuários |

## Grafo

```
Cliente → OS → Visita → Parada → Rota → Funcionário + Veículo → GPS
```

## API entregue

| Endpoint | Uso |
| --- | --- |
| `GET /ops/snapshot` | Home + mapa (já existia) |
| `GET /ops/customers/summary` | KPI strip clientes |
| `GET /ops/employees/summary` | KPI strip funcionários |
| `GET /ops/vehicles/summary` | KPI strip frota |
| `GET /ops/service-orders/summary` | KPI strip OS |
| `GET /ops/routes/summary` | KPI strip rotas do dia |
| `GET /ops/customers/:id` | Context card prontuário |
| `GET /ops/vehicles/:id` | Context card veículo |
| `GET /ops/employees/:id` | Context card funcionário |
| `GET /ops/service-orders/:id` | Context card OS |
| `GET /ops/customers/list-enriched` | Lista + colunas operacionais |
| `GET /ops/employees/list-enriched` | Lista + rota/live |
| `GET /ops/vehicles/list-enriched` | Lista + rota/motorista |

## KPIs NOW vs alvo

| KPI | NOW | Alvo (doc) |
| --- | --- | --- |
| R$ custo | não renderizar | tema 15 |
| Check-in / em atendimento | 0 ou — | tema 12 |
| WhatsApp timeline | não | pós-MVP |
| Pontualidade % | não | tema 14+ |

## Web

- `OperationalSummaryStrip` + `EntityContextPanel` em `apps/web/src/components/ops/`
- Listas: Clientes, Funcionários, Veículos, OS, Agenda
- Rotas: aba “Hoje” + planejador
- Nav: Recursos / Administração

## Docs

- PRD 1.5 UX v1.0
- `docs/screens/*` seções 13–18 nas entidades operacionais

## Critérios de aceite

- [x] KPI strip alimentado por API (sem números inventados)
- [x] Detalhe Cliente/Veículo/Funcionário/OS com resumo + timeline real
- [x] Papéis respeitados
- [x] Fichas e PRD §13 coerentes
