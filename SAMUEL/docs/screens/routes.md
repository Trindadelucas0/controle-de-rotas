# PRD UX/Funcional — Rotas / planejador (v0.16.10)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §3.5.

## Tela: Rotas

### 1. Identidade

- Rota: `/routes`
- Papéis: ADMIN, MANAGER (publicar + gerir); SUPERVISOR (preview / ver); EMPLOYEE 403
- Objetivo: visão operacional do dia + planejador + gestão de rota antes do Play
- Arquivos: `routes/page.tsx`, `RoutesTodayView.tsx`, `RouteManagePanel.tsx`, `RoutesPlanner*.tsx`

### 2. Abas

**Rotas de hoje:** summary + lista `Rota NN`, status, N paradas, km. Em cada card: **Gerir** (ADMIN/MANAGER em `PLANNED`|`PUBLISHED`) ou **Ver** (demais / status não editável). Abre painel lateral/bottom sheet. ADMIN: **Excluir rota** no painel se não estiver Em andamento.

**Planejador:** modos Clientes | Visitas agendadas | **Gravar cliente**. No modo Clientes: checkbox **Gravar viagem** (`recordTrip`) — aplica a todas as rotas do lote (1+ clientes); densifica GPS, fila local e grava trilha no check-in de cada cliente (retry no finalizar). Seletor **Origem do cálculo**: última localização do funcionário (padrão) ou pin da empresa.

**Gravar cliente:** funcionário + data + veículo → **Publicar missão de gravar**. Sem lista de clientes. Rotas de hoje mostram o card **Gravar acesso**. Painel Gerir não edita paradas dessa missão (placeholder interno).

### 3. Painel Gerir rota

```
GERIR ROTA · status
Data · Funcionário · Veículo
Paradas (clientes): 1. Nome [↑][↓][Remover] …
[+ Adicionar] → busca visitas livres do dia (nome do cliente / OS)
Preview km · duração
[Cancelar rota] [Excluir rota]  [Fechar]  [Salvar alterações]
```

- Só muta (salvar/cancelar) se `PLANNED` | `PUBLISHED` e papel ADMIN/MANAGER
- Cancelar: confirma → `POST /routes/:id/cancel` → fecha e atualiza lista
- Excluir (ADMIN/PLATFORM_ADMIN, qualquer status **exceto** `IN_PROGRESS`): confirma → `DELETE /routes/:id` → 204; some da lista
- Salvar: `POST /routes/preview` (debounce) → `PATCH /routes/:id`
- Incluir cliente sem visita prévia: fora do painel (Planejador / Serviços)
- `IN_PROGRESS`: leitura; sem Salvar/Cancelar/Excluir
- `COMPLETED` / `INCOMPLETE` / `CANCELLED`: leitura; ADMIN pode Excluir

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

Iguais à ficha anterior: preview-customers, dispatch-customers (`originMode`); SUPERVISOR sem Publicar; origem sem pin → aviso Empresa. Sem GPS no modo última loc. → aviso + fallback E. Gestão: `PATCH` / `cancel` só ADMIN/MANAGER. Excluir: `DELETE` só ADMIN (não `IN_PROGRESS`).

### 7. Fora de escopo

Play/GPS nesta tela; editar/cancelar/excluir rota `IN_PROGRESS`; criar OS no PATCH do painel.

### 8. Como testar

1. Publicar rota no Planejador → Rotas de hoje → **Gerir**.
2. Trocar funcionário → Salvar → Minha rota do novo funcionário vê a rota.
3. Remover parada / reordenar → Salvar → preview e lista coerentes; visita removida livre.
4. Cancelar rota → status Cancelada; visitas voltam ao planejador de visitas.
5. Rota Em andamento → **Ver** sem Salvar/Cancelar/Excluir; API 422 `ROUTE_IN_PROGRESS` se forçar DELETE.
6. SUPERVISOR: Ver sem Salvar/Cancelar/Excluir.
7. ADMIN: **Excluir rota** em Planejada/Publicada/Concluída/Incompleta/Cancelada → some da lista; visitas ASSIGNED ficam livres.
8. Aba **Gravar cliente** → funcionário + data + veículo → Publicar → Rotas de hoje mostra **Gravar acesso** (sem “Sessão de gravação”).
