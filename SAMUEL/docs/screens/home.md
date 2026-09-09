# PRD UX/Funcional — Centro de Operações (v0.14)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §3.1.

## Tela: Centro de Operações (home)

### 1. Identidade

- Rota: `/`
- Papéis: todos autenticados; snapshot da empresa só ADMIN, MANAGER, SUPERVISOR
- Objetivo: em ~3 segundos o gestor lê o estado do dia (não lista de componentes)
- Layout (blocos): atenção (alertas) → execução → faixa Equipe/Visitas/Rotas/Ao vivo → equipe ao vivo / próximas / rotas
- Visual: canvas `#121212`, KPIs em faixa densa (não 4 cards iguais), Overpass
- Arquivo: `OpsHomePage.tsx`

### 2. Componentes (gestor)

```
H1 Centro de Operações + Dia
├── faixa 4 colunas: EQUIPE | VISITAS | ROTAS | AO VIVO
├── Execução do dia (barra) | Alertas
├── Equipe ao vivo | Próximas visitas
└── Rotas do dia
```

EMPLOYEE: capa com Minha rota / Agenda / Clientes (sem snapshot).

### 3. Informação / KPI (só API)

Fontes: `GET /ops/snapshot`, `GET /ops/routes/summary`, `GET /visits?from&to`, `GET /routes?date=`.

| Bloco | Campos |
| --- | --- |
| EQUIPE | `team.total`; linhas: inRoute, inService (ou —), parado/available se >0, offline |
| VISITAS | `visits.planned`; completed, inProgress, delayed/cancelled se >0 |
| ROTAS | `routes.count`; summary inProgress/published/completed; km plan. se houver |
| AO VIVO | `team.onlineLive`; online/offline de `live[]`; N alertas warning/critical |
| Execução | se planned>0: completed/planned %; senão `routes.executionPercent` ou — |
| Alertas | `alerts[]` com message/severity da API (sem rótulos inventados) |
| Equipe ao vivo | `live[]` — presença + status operacional (`Em rota` = IN_ROUTE) |
| Próximas visitas | visitas do dia ordenadas; empty = “Nenhuma visita neste dia.” |
| Rotas do dia | ordinal “Rota 01”, funcionário, N paradas, **Concluídas —**, status |

Regra: campo ausente → `—` / omitir. Não inventar “trabalhando”, “pendentes”, “GPS perdido”.

### 4. Ações

Cards → `/employees` ou `/map`, `/agenda`, `/routes`, `/map`. Empty dia → Rotas / Serviços.

### 5. Estados

loading 4 skeletons | error role=alert | empty live/alertas/visitas/rotas | empty dia | EMPLOYEE capa | sem sessão

### 6. Fora de escopo

Ranking, custos R$, telemetria fictícia.

### 7. Como testar

1. ADMIN → faixa 4 colunas + execução + live + próximas + rotas.
2. Dia vazio → empty + CTAs.
3. EMPLOYEE → capa sem KPI.
4. `executionPercent` null e planned=0 → Execução —.
