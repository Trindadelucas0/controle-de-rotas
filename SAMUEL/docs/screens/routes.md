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

**Planejador:** modos Clientes | Visitas agendadas | **Gravar cliente** | **Região**. No modo Clientes: checkbox **Gravar viagem** (`recordTrip`) — aplica a todas as rotas do lote (1+ clientes); densifica GPS, fila local e grava trilha no check-in de cada cliente (retry no finalizar). **O traçado usa as ruas (OSRM) até o pin**; a trilha ACTIVE só entra se o mapa falhar. Seletor **Origem do cálculo**: última localização do funcionário (padrão) ou pin da empresa. A ordem das paradas é a duração dessas ruas (se a tabela falhar, mais perto → mais longe).

**Gravar cliente:** funcionário + data + veículo → **Publicar missão de gravar**. No celular / PWA o botão fica fixo acima da barra inferior (Início, Agenda, Mapa, Rotas, Mais). Sem lista de clientes. Rotas de hoje mostram o card **Gravar acesso**. Painel Gerir não edita paradas dessa missão (placeholder interno).

**Região:** mapa clicável (pin arrastável) = centro; raio padrão 5 km (slider 0,5–50 km); barra de escala métrica; o zoom **não** acompanha o slider (o círculo cresce/diminui no mesmo zoom; clique/arraste/**busca de endereço** reenquadra). Nome opcional (vazio → “Raio 5 km”); **Buscar endereço (opcional)** (Nominatim, debounce, Enter aplica a 1ª sugestão, pins de preview no mapa); pins cinza = clientes já no raio (não viram paradas). **Publicar missão** (ADMIN/MANAGER) no sucesso **limpa** centro/busca/raio/nome/func/veículo (data mantida; mapa Brasil) para a próxima região. Origem da rota = centro. Rotas de hoje: **Gravar região · {nome}**. Campo identifica região por `assignmentRegionRadiusMeters != null`.

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

Iguais à ficha anterior: preview-customers, dispatch-customers (`originMode`); dispatch-record-mission; dispatch-region-mission; SUPERVISOR sem Publicar; origem sem pin → aviso Empresa. Sem GPS no modo última loc. → aviso + fallback E. Gestão: `PATCH` / `cancel` só ADMIN/MANAGER. Excluir: `DELETE` só ADMIN (não `IN_PROGRESS`).

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
8. Aba **Gravar cliente** → funcionário + data + veículo → **Publicar missão de gravar** visível acima da barra inferior no celular → Rotas de hoje mostra **Gravar acesso** (sem “Sessão de gravação”).
9. Aba **Região** → **Buscar endereço** (ex. Unai) + Enter ou clique na sugestão → mapa no círculo; ou clique no mapa. Raio 5 km + funcionário/veículo → Publicar → Rotas de hoje **Gravar região**; o formulário limpa (data permanece). SUPERVISOR sem botão Publicar.
