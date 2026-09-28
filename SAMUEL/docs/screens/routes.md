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

**Região:** cadastro que permanece no mapa (não publica missão). Mapa clicável (pin arrastável) = centro; raio padrão 5 km (slider 0,5–50 km); barra de escala métrica; o zoom **não** acompanha o slider. **Nome da região** obrigatório. **Buscar endereço (opcional)**. Lista **Regiões salvas**; **Salvar região** (`POST/PATCH /api/v1/customer-regions`, ADMIN/MANAGER/SUPERVISOR). Nome já usado na empresa → “Essa região já está cadastrada.” **Excluir** tira o círculo e deixa os clientes sem região. Pins cinza = clientes no raio do rascunho. Se um cliente vinculado ficar fora, o km gravado sobe além de 50 km e o centro continua no pin. Círculos salvos também aparecem nos mapas de clientes, no mapa operacional e no campo. Missão **Gravar região** já publicada (data/funcionário/veículo) não se cria mais nesta aba; rota antiga ainda abre no campo por `assignmentRegionRadiusMeters != null`.

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

**Mobile / PWA (`<768px`):** o CTA de cada modo fica em `MobileActionBar`, fixa acima da barra Início/Agenda/Mapa/Rotas/Mais enquanto a lista do painel rola — **Publicar rotas** (Clientes), **Salvar rota** + **Publicar** (Visitas agendadas), **Publicar missão de gravar** (Gravar cliente) e **Salvar região** + **Excluir** (Região). Na aba **Mapa** do planejador o painel fica oculto e a barra some junto. Em `md+` nada muda: os botões seguem no fluxo do painel lateral.

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
9. Aba **Região** → **Buscar endereço** (ex. Unaí) + Enter ou clique na sugestão → mapa no círculo; ou clique no mapa. Nome + raio → **Salvar região**. Recarregar a aba: o círculo continua. Salvar de novo com o mesmo nome → aviso de já cadastrada. Não há Data, Funcionário, Veículo nem **Publicar missão**.
10. Celular, aba **Lista** do planejador: em Clientes, Visitas agendadas, Gravar cliente e Região o botão de publicar/salvar já aparece embaixo, acima da barra inferior, sem rolar o painel; trocar para a aba **Mapa** esconde esse botão.
