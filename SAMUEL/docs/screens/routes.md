# PRD UX/Funcional — Rotas / planejador (v0.16.10)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §3.5.

## Tela: Rotas

### 1. Identidade

- Rota: `/routes`
- Papéis: ADMIN, MANAGER (publicar + gerir); SUPERVISOR (preview / ver); EMPLOYEE 403
- Objetivo: visão operacional do dia + planejador + gestão de rota antes do Play
- Arquivos: `routes/page.tsx`, `RoutesTodayView.tsx`, `RouteManagePanel.tsx`, `RoutesPlanner*.tsx`

### 2. Abas

**Rotas de hoje:** summary + lista `Rota NN`, status, N paradas, km. Em cada card: **Gerir** (ADMIN/MANAGER em `PLANNED`|`PUBLISHED`) ou **Ver** (demais / status não editável). Abre painel lateral/bottom sheet.

**Planejador:** modos Clientes | Visitas agendadas. No modo Clientes: checkbox **Gravar viagem** (`recordTrip`) — aplica a todas as rotas do lote (1+ clientes); densifica GPS, fila local e grava trilha no check-in de cada cliente (retry no finalizar). Seletor **Origem do cálculo**: última localização do funcionário (padrão) ou pin da empresa.

### 3. Painel Gerir rota

```
GERIR ROTA · status
Data · Funcionário · Veículo
Paradas (clientes): 1. Nome [↑][↓][Remover] …
[+ Adicionar] → busca visitas livres do dia (nome do cliente / OS)
Preview km · duração
[Cancelar rota]  [Fechar]  [Salvar alterações]
```

- Só muta se `PLANNED` | `PUBLISHED` e papel ADMIN/MANAGER
- Cancelar: confirma → `POST /routes/:id/cancel` → fecha e atualiza lista
- Salvar: `POST /routes/preview` (debounce) → `PATCH /routes/:id`
- Incluir cliente sem visita prévia: fora do painel (Planejador / Serviços)
- `IN_PROGRESS` / `COMPLETED` / `CANCELLED`: leitura; sem Salvar/Cancelar

### 4. Planejador modo Clientes — layout

```
PLANEJADOR
Data · Roundtrip · Gravar viagem · Origem do cálculo (F | E) · Funcionários · Busca clientes
RESUMO: N funcionários · N paradas · km · duração · N rotas
ROTA 01 — JOÃO
  F ou E → 1 → 2 → 3 → E (se roundtrip)
  totais + Remover por parada
[Publicar] (ADMIN/MANAGER)
MAPA: LineStrings + F (última loc.) + E (empresa, se roundtrip ou modo Empresa)
```

KPI só do preview (`assignments` / `grandTotals`). Ausente → —.

### 5. Cores (inalteradas)

azul `#1d4ed8` preview estrada; âmbar `#d97706` reta; E verde/laranja empresa; F pin do funcionário; teal operacional no mapa hub.

### 6. Ações / estados / permissões

Iguais à ficha anterior: preview-customers, dispatch-customers (`originMode`); SUPERVISOR sem Publicar; origem sem pin → aviso Empresa. Sem GPS no modo última loc. → aviso + fallback E. Gestão: `PATCH` / `cancel` só ADMIN/MANAGER.

### 7. Fora de escopo

Play/GPS nesta tela; editar/cancelar rota `IN_PROGRESS`; criar OS no PATCH do painel.

### 8. Como testar

1. Publicar rota no Planejador → Rotas de hoje → **Gerir**.
2. Trocar funcionário → Salvar → Minha rota do novo funcionário vê a rota.
3. Remover parada / reordenar → Salvar → preview e lista coerentes; visita removida livre.
4. Cancelar rota → status Cancelada; visitas voltam ao planejador de visitas.
5. Rota Em andamento → **Ver** sem botões de mutação; API 422 se forçar PATCH.
6. SUPERVISOR: Ver sem Salvar/Cancelar.
