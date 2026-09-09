# Tema 14 — Dashboard (KPIs)

**Status:** planned

**Pré-requisitos úteis:** rotas publicadas (09) + execução/tracking (10–11) + visitas concluídas (12). Sem isso o dashboard só mostra planejado.

## Escopo planejado

KPIs mínimos **planejado vs real**:

- Visitas: planejadas / concluídas / pendentes / atrasadas (definição de atraso na implementação)
- Rotas: publicadas / em andamento / concluídas do dia
- KM: `plannedDistanceMeters` vs `actualDistanceMeters` (actual depende do tracking)
- Status operacional da frota (agregado; presence ≠ status — ver tema 11)

## Telas previstas

| Rota | Papéis | Objetivo |
| --- | --- | --- |
| `/dashboard` | ADMIN, MANAGER, SUPERVISOR | Visão do dia / intervalo curto |

A home `/` permanece shell de sessão até este tema (ou até redirect explícito).

## APIs previstas

| Método | Path (proposto) | Notas |
| --- | --- | --- |
| `GET` | `/api/v1/dashboard?from&to` | Agregados por `companyId` do JWT |

## Fora de escopo

- BI completo, heatmap, replay UI rico
- Custos e combustível (tema 15)
- Chatwoot
- Gráficos sem dados reais (não inventar métricas)

## Critérios de aceite (quando done)

- [ ] Números batem com contagens de visitas/rotas do mesmo filtro
- [ ] SUPERVISOR leitura; EMPLOYEE sem acesso (ou escopo próprio — decidir na implementação e documentar)
- [ ] Empty state quando não há operação no período
- [ ] Docs screen + API

## Como validar (quando implementado)

1. Dia com N visitas planejadas e M concluídas → cards batem.
2. Rota com planned KM e tracking → actual preenchido ou “—” se sem tracking.
