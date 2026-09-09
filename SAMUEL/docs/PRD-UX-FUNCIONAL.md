# PRD UX/Funcional v0.9 — Tela por Tela

| Campo | Valor |
| --- | --- |
| Produto | Rotas |
| Versão deste PRD | **0.9** |
| Data | 29/08/2026 |
| Software correspondente | v0.12.1 |
| Status | Documenta **somente telas que existem no código** |
| Fonte de produto | [`PRD.md`](../PRD.md) |
| Fichas por rota | [`docs/screens/`](screens/) |
| Comportamento | [`DOCUMENTACAO-SISTEMA.md`](../DOCUMENTACAO-SISTEMA.md) |

Este arquivo é a fonte canônica de **UX/funcional tela a tela**. Não inventa tela, KPI, filtro, ação nem estado. KPI sem dado na API **não aparece** ou mostra `—` — nunca placeholder inventado.

**Modelo de domínio:** `Customer → ServiceOrder → Visit → RouteStop → Route → Employee + Vehicle`

---

## 0. Convenções

### 0.1 Ficha padrão (todas as telas)

Cada tela abaixo descreve:

| # | Bloco | O que cobre |
| --- | --- | --- |
| 1 | Identidade | rota, papéis, objetivo, arquivo |
| 2 | Componentes | árvore de UI |
| 3 | Informação | campos, colunas, labels reais |
| 4 | KPI | totais da API; N/A em formulários de auth |
| 5 | Filtros | busca, status, data, equipe |
| 6 | Ações | botões e efeito |
| 7 | Estados | idle, loading, empty, error, forbidden, success |
| 8 | Permissões | nav + botão + API |
| 9 | Navegação | de / para / query |

### 0.2 Chrome vs conteúdo

Middleware Next **só exige cookie** `access_token`. Papel filtra **sidebar, botões e API (403)**. Abrir URL direta sem papel não tem tela “Forbidden” dedicada — a API devolve 403 e a UI mostra erro.

### 0.3 Áreas de informação

| Área | Telas |
| --- | --- |
| Operação | Início, Mapa, Agenda, Serviços, Rotas |
| Recursos | Clientes, Funcionários, Veículos |
| Execução | Minha rota, Iniciar rota, Navegar, Visita (check-in), Status GPS + trava PWA |
| Administração | Empresa, Usuários |
| Auth | Login, esqueci senha, redefinir, alterar senha |

### 0.4 Componentes compartilhados (ops)

| Componente | Uso |
| --- | --- |
| `OperationalSummaryStrip` | KPI strip nas listas; esconde item com valor `—` ou vazio; loading = 4 skeletons; erro = faixa vermelha |
| `EntityContextPanel` | Detalhe: status, métricas, relacionamentos, timeline (máx. 6), ações habilitadas com `href` |
| `PageHeader` / `FormCard` / `DataTable` | Cadastros (`crud.tsx`) |
| `FieldPwaLocationGate` | Overlay em todo `/field/*` |

### 0.5 Telas previstas (não existem)

| Rota | Tema | Motivo de não documentar como tela viva |
| --- | --- | --- |
| `/field/visits/[id]` (notas/check-out) | 12 | WP1 só check-in; ficha viva: [field-visit.md](screens/field-visit.md) |
| `/field/visits/[id]/evidence` | 13 | fotos |
| `/settings/audit` | 16 | UI de `audit_logs` |
| `/dashboard` | — | **não** criar; tema 14 enriquece `/` |

---

## 1. Chrome compartilhado (não é rota)

### 1. Identidade

- Rotas cobertas: todas autenticadas **exceto** `/field/navigate` e `/field/visits/[id]` (layout tela cheia)
- Arquivos: `apps/web/src/app/(app)/layout.tsx`, `AppHeader.tsx`, `AppNav.tsx`, `UserMenu.tsx`
- Full-bleed (sem `max-w-5xl`): `/` e `/map`

### 2. Componentes

```
flex min-h-screen
├── aside desktop (lg+): marca Rotas + nome da empresa + AppSidebarNav
├── drawer mobile: overlay + mesma nav (☰ no header)
└── coluna
    ├── AppHeader: ☰ | Rotas | UserMenu (nome, role, Alterar senha, Sair)
    └── main (full-bleed em / e /map)
```

### 3. Informação — grupos do menu (`AppSidebarNav`)

**Operação**

| Item | Rota | Quem vê |
| --- | --- | --- |
| Início | `/` | todos autenticados |
| Mapa | `/map` | ADMIN, MANAGER, SUPERVISOR |
| Agenda | `/agenda` | ADMIN, MANAGER, SUPERVISOR, EMPLOYEE |
| Serviços | `/services` | ADMIN, MANAGER, SUPERVISOR |
| Rotas | `/routes` | ADMIN, MANAGER, SUPERVISOR |
| Campo | `/field/my-route` | EMPLOYEE |

**Recursos:** Clientes (todos) · Funcionários (ADMIN, MANAGER) · Veículos (ADMIN, MANAGER)

**Administração:** Empresa · Usuários (só ADMIN)

### 4. KPI

N/A no chrome.

### 5. Filtros

N/A.

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Clique no item | navega; fecha drawer no mobile |
| Marca “Rotas” | `/` |
| Alterar senha | `/account/change-password` |
| Sair | `POST /auth/logout` → `/login` (botão “Saindo…” enquanto busy) |

### 7. Estados

| Estado | UI |
| --- | --- |
| loading sessão | skeleton no header + `h-40` no main |
| idle | nav filtrada pelo `user.role` |
| sem sessão | header sem UserMenu; `fetchMe` falha redireciona via api-client |

### 8. Permissões

Itens sem `roles` (Início, Clientes) aparecem para todos. Demais itens somem da nav se o papel não estiver na lista.

### 9. Navegação

Layout `(field-nav)` **não** usa este chrome. Campo `/field/my-route`, `/field/start/[id]`, `/field/tracking-status` usam chrome + `FieldPwaLocationGate`.

Ficha: [home-shell.md](screens/home-shell.md)

---

## 2. Autenticação

### 2.1 Login — `/login`

**Papéis:** público. Já autenticado → redirect `/`.

**Componentes:** `AuthCard` (marca Rotas, H1 “Entrar”) → `LoginForm` (banner `?changed=1`, e-mail, `PasswordField`, `FormError`, “Entrar”, link “Esqueci minha senha”).

**Informação**

| Campo | Validação | Erro |
| --- | --- | --- |
| E-mail | required + formato | “Informe um e-mail válido.” |
| Senha | min 8 | “A senha deve ter pelo menos 8 caracteres.” |

Banner: “Senha alterada. Entre novamente.” se `?changed=1`.

**KPI / filtros:** N/A.

**Ações:** Entrar → `POST /api/v1/auth/login` → `safeNextPath(?next)` (default `/`). Esqueci senha → `/forgot-password`.

**Estados:** idle · loading (campos disabled) · invalid (`role=alert`) · 401 “E-mail ou senha inválidos.” · 403 inativo/suspenso · 429 “Muitas tentativas…” · rede “Falha de rede…” · success redirect. Empty/forbidden: N/A.

**Permissões:** público. Middleware redireciona quem tem `access_token`.

**Navegação:** de middleware (`?next=`), change-password, logout. Query: `next`, `changed`.

**Fora de escopo:** MFA, SSO, lembrar-me, signup.

Ficha: [login.md](screens/login.md)

---

### 2.2 Esqueci a senha — `/forgot-password`

**Papéis:** público.

**Componentes:** `AuthCard` → e-mail + “Enviar link” + “Voltar”; sucesso = alerta verde + “Voltar ao login”.

**Informação:** e-mail obrigatório. Sucesso genérico (`data.message`) **igual** se o e-mail existir ou não (não vaza existência). Token só no **log da API** (sem SMTP).

**KPI / filtros:** N/A.

**Ações:** `POST /api/v1/auth/forgot-password`; Voltar → `/login`.

**Estados:** idle · loading · invalid · error/429 · success `role=status`.

**Permissões:** público. Com cookie, middleware manda para `/`.

Ficha: [forgot-password.md](screens/forgot-password.md)

---

### 2.3 Redefinir senha — `/reset-password?token=`

**Papéis:** público com token.

**Componentes:** sem token → “Link inválido…” + Voltar. Form: Nova senha + Confirmar + “Redefinir”. Success: “Senha alterada. Faça login.” + CTA.

**Informação:** min 8; confirmar igual (“As senhas não coincidem.”).

**Ações:** `POST /api/v1/auth/reset-password` `{ token, password, passwordConfirmation }`.

**Estados:** invalid sem token (sem API) · loading · error (token reusado/expirado) · success.

**Navegação:** token vem do log após forgot-password. Para: `/login`.

Ficha: [reset-password.md](screens/reset-password.md)

---

### 2.4 Alterar senha — `/account/change-password`

**Papéis:** qualquer autenticado (com chrome).

**Componentes:** `ChangePasswordForm` max-w-md: senha atual, nova, confirmar, “Alterar senha”.

**Informação:** nova ≠ atual; min 8; confirmar igual.

**Ações:** `PATCH /api/v1/auth/change-password` → `/login?changed=1` (sessões revogadas).

**Estados:** idle · loading · invalid · error API (senha atual errada) · success = redirect forçado.

**Navegação:** UserMenu “Alterar senha”.

Ficha: [change-password.md](screens/change-password.md)

---

## 3. Operação

### 3.1 Centro de Operações — `/`

**Papéis:** todos autenticados. Snapshot da empresa **só** ADMIN, MANAGER, SUPERVISOR. EMPLOYEE vê capa de campo (não chama `/ops/snapshot` com sucesso).

**Arquivo:** `OpsHomePage.tsx`

#### Variante A — Gestor

**Componentes**

```
H1 Centro de Operações + seletor Dia
├── faixa 4 colunas: EQUIPE | VISITAS | ROTAS | AO VIVO
├── Execução do dia (barra) | Alertas
├── Equipe ao vivo | Próximas visitas (GET /visits)
└── Rotas do dia (GET /routes?date=) — Concluídas —
```

**Informação / KPI** (`GET /api/v1/ops/snapshot?date=` + summary rotas + visitas + rotas do dia)

| Bloco | Cards (label → campo) | Clique |
| --- | --- | --- |
| Equipe | total → `team.total`; linhas inRoute / inService / offline (+ parado/available se >0) | `/employees` se ADMIN/MANAGER; senão `/map` |
| Visitas | planned; completed / inProgress (+ delayed/cancelled se >0) | `/agenda` |
| Rotas | count; summary inProgress/published/completed | `/routes` |
| Ao vivo | onlineLive; online/offline de live[]; N alertas warning/critical | `/map` |
| Execução | planned>0 → completed/planned %; senão executionPercent ou — | — |
| Alertas | `alerts[]` API (VISITS_DELAYED, EMPLOYEES_NO_GPS, …) | — |

Regra: ausente → `—`. Label operacional `IN_ROUTE` = **Em rota**.

**Operação ao vivo:** `live[]` — presença + status operacional.

**Próximas visitas / Rotas do dia:** dados reais; empty copy; paradas concluídas na listagem = —.

Hint: “Em atendimento” só se `!meta.inServiceAvailable`.

**Filtros:** campo **Dia**.

**Ações:** cards com `href`; empty → Rotas / Serviços.

**Estados:** loading 4 skeletons | error | empty live/alertas/visitas/rotas | empty dia | sem sessão

**Permissões:** SUPERVISOR: Equipe → `/map`. EMPLOYEE: variante B.

#### Variante B — EMPLOYEE

**Componentes:** “Olá, {nome}” · empresa · Campo. Três cards: Minha rota, Agenda, Clientes.

**KPI:** N/A (sem snapshot).

**Estados:** idle. Sem loading de ops.

**Navegação:** `/field/my-route`, `/agenda`, `/customers`.

Ficha: [home.md](screens/home.md)

---

### 3.2 Mapa operacional — `/map`

**Papéis:** ADMIN, MANAGER, SUPERVISOR (nav). EMPLOYEE sem item.

**Arquivo:** `OperationalMap.tsx`

**Componentes (v0.14 — centro de comando)**

```
toolbar: Busca, Status, Data, Equipe, Filtrar, camadas [Clientes|Equipe|Rotas|Todos], Ao vivo
├── mapa MapLibre
└── trilho direito ~300px (desktop): Equipe | detalhe funcionário | detalhe cliente
mobile: mapa + abas Equipe | Detalhe; drawer ☰
```

**Camadas:** Clientes = pins; Equipe = carros live; Rotas = LineString pintada (sem geometria → aviso); Todos = todas. Não são filtros de negócio novos.

**Detalhe funcionário:** Status operacional ≠ Presença; rota (status); veículo; parada atual; próxima PENDING; Ver rota / Ver funcionário (ADMIN/MANAGER).

**Detalhe cliente:** context card; categoria —; OS abertas (contagem); ações API.

**KPI:** resumo compacto no trilho (snapshot). Badge Ao vivo = carros visíveis na camada Equipe/Todos.

**Filtros / ações / poll:** iguais (Busca/Status/Data/Equipe; 3s live; 15s snapshot; `?employeeId=`).

**Fora de escopo:** WebSocket; N rotas do dia sem geometry; #OS inventado.

Ficha: [map.md](screens/map.md)

---

### 3.3 Agenda — `/agenda`

**Papéis:** todos autenticados. EMPLOYEE: só próprias visitas (backend).

**Arquivo:** `AgendaPage.tsx`

**Componentes:** `PageHeader` “Agenda” · `OperationalSummaryStrip` · date + Atualizar · cards | skeleton | empty.

**Informação (card):** hora local + status visita · OS # — título · cliente (`tradeName` \|\| `name`) · funcionário ou “Sem funcionário atribuído” · botão Abrir OS (não-EMPLOYEE).

**KPI** (`GET /ops/agenda/summary?date=`): Planejadas, Concluídas, Em andamento, Atrasadas, Canceladas. Erro strip: “KPIs indisponíveis”.

**Filtros:** **Data** → `GET /visits?from&to` (início/fim do dia local).

**Ações:** mudar data / Atualizar; Abrir OS → `/services/[id]`.

**Estados:** loading skeleton `h-32` · empty “Nenhuma visita neste dia.” · error texto vermelho · forbidden N/A (API filtra).

**Permissões:** EMPLOYEE sem Abrir OS.

**Navegação:** de nav e empty de Minha rota “Ver agenda”.

Ficha: [agenda.md](screens/agenda.md)

---

### 3.4 Ordens de serviço

#### Lista — `/services`

**Papéis:** leitura ADMIN/MANAGER/SUPERVISOR. Mutação ADMIN/MANAGER. EMPLOYEE sem nav.

**Componentes:** `PageHeader` + Novo · strip KPI · busca + select status · `DataTable`.

**Informação (colunas):** #, Título, Cliente, Status, Prioridade, Visitas (`visitsCount`), Abrir.

**KPI** (`GET /ops/service-orders/summary`): Total, Abertas, Em andamento, Concluídas, Canceladas.

**Filtros:** `q` título/cliente · status Todos / Aberta / Em andamento / Concluída / Cancelada → `GET /service-orders?q&status`.

**Ações:** Novo → `/services/new` (só manage); Buscar; Abrir → `/services/[id]`.

**Estados:** skeleton · empty “Nenhuma ordem de serviço.” · error.

#### Nova — `/services/new?customerId=`

**Papéis:** ADMIN, MANAGER.

**Campos:** Cliente * · Título * (min 2) · Descrição · Prioridade LOW/NORMAL/HIGH/URGENT · Prazo · checkbox “Agendar primeira visita” (se marcado: início obrigatório) · funcionário opcional.

**KPI / filtros:** N/A (selects carregam customers/employees).

**Ações:** Criar → `POST /service-orders` → `/services/:id`. `?customerId=` pré-seleciona e marca 1ª visita.

**Estados:** boot skeleton · invalid · loading · error · success redirect.

#### Detalhe — `/services/[id]`

**Componentes:** header OS #n · `EntityContextPanel` · card dados · Cancelar · lista visitas | “Nenhuma visita agendada.” · form Adicionar visita (manage e não cancelada).

**KPI painel:** Visitas, Visitas abertas, Última visita. Ações: Abrir cliente, Ver rotas (se houver), Ver agenda (se houver visitas).

**Ações:** Cancelar → `POST /service-orders/:id/cancel` (confirmação) · Adicionar visita → `POST .../visits` · link cliente.

**Estados:** loading · not found · error · empty visitas · SUPERVISOR sem cancelar/adicionar.

**Fora de escopo:** PATCH campos da OS nesta UI; evidência; check-in.

Ficha: [services.md](screens/services.md)

---

### 3.5 Rotas — `/routes`

**Papéis:** ADMIN, MANAGER (publicar); SUPERVISOR (preview); EMPLOYEE 403.

**Arquivos:** `routes/page.tsx`, `RoutesTodayView.tsx`, `RoutesPlanner*.tsx`

**Componentes (v0.14 — planejador operacional)**

```
H1 Rotas
├── tabs: Rotas de hoje | Planejador
├── Hoje: Rota NN — Nome · status · N paradas · Concluídas — · km
└── Planejador Clientes:
    PLANEJADOR (data, roundtrip, origem F|E, funcs, busca)
    RESUMO (funcs, paradas, km, duração, rotas)
    ROTA 01 — NOME · F/E → 1 → 2 → E
    [Publicar] + mapa (azul road / âmbar reta / F funcionário / E empresa)
```

Modo Visitas agendadas: inalterado nesta entrega.

**KPI / ações / estados / permissões:** iguais (summary + preview-customers + dispatch). SUPERVISOR sem Publicar. Campo ausente → —.

Ficha: [routes.md](screens/routes.md)

---

## 4. Recursos

### 4.1 Clientes

#### Lista — `/customers`

**Papéis:** todos autenticados (listar/criar/ver). Update: SUPERVISOR+.

**Componentes:** `PageHeader` + Novo · strip · busca · `DataTable`.

**Informação (colunas):** Nome, Documento, Cidade, OS abertas, Próxima visita, Localização (`locationStatus`), Status, Abrir.

**KPI** (`GET /ops/customers/summary`): Total, Ativos, Com pin, Visita hoje, OS abertas, Sem visita 30d. Lista enriquecida: `GET /ops/customers/list-enriched`.

**Filtros:** `q` → `GET /customers?q=`.

**Ações:** Novo → `/customers/new`; Abrir → `/customers/[id]`.

**Estados:** skeleton · empty “Nenhum cliente.” · error · strip “KPIs indisponíveis”.

#### Novo / Editar — `/customers/new`, `/customers/[id]`

**Componentes:** form dados + busca endereço Nominatim + CEP/CNPJ lookups + `CustomerLocationMap` (pin **obrigatório**) + categoria/prioridade/obs/status + `EntityContextPanel` no edit.

**Campos (resumo):** Nome * · fantasia · CPF/CNPJ (14 dígitos → BrasilAPI + pin) · telefone, WhatsApp, e-mail · CEP (8 dígitos → BrasilAPI + pin) · rua/número/complemento/bairro/cidade/UF · pin clique/arraste (lat/lng **não** digitáveis) · categoria, prioridade, observações · Status ACTIVE/INACTIVE.

Erro sem pin: “Marque o local no mapa…”

**KPI detalhe:** OS abertas, Visitas, Última visita, Próxima visita. Relacionamentos: Responsável, Rota. Timeline visitas. Ações do card: Criar OS, Adicionar à rota, Abrir prontuário, Ver histórico, Ver rota (conforme `enabled`).

**Ações:** Salvar `POST/PATCH /customers` (bloqueia sem pin).

**Estados:** skeleton detalhe · saving · invalid pin · lookup hints (Buscando CNPJ…, CNPJ aplicado., não encontrado, rate_limit) · success create → `/customers/:id` · 403 update sem papel.

**Mobile:** form empilhado; mini-mapa ~280px. Tabela da lista: scroll horizontal.

**Fora de escopo:** import CSV, checksum CNPJ, lookup CPF, contatos múltiplos.

Ficha: [customers.md](screens/customers.md)

---

### 4.2 Funcionários

#### Lista — `/employees`

**Papéis:** ADMIN, MANAGER.

**Colunas:** Nome, Cargo, Status (RH), Operacional, Rota hoje, Acesso (“Com login” / “Sem login”), Editar.

**KPI** (`GET /ops/employees/summary`): Total, Ativos, Com login, Rotas hoje, GPS online.

**Filtros:** `q` → `GET /employees?q=`.

**Estados:** empty “Nenhum funcionário.” · 403.

#### Novo — `/employees/new`

Cria Employee + User EMPLOYEE na mesma transação. Campos: Nome * · e-mail * · senha * min 8 · telefone, cargo, matrícula, especialidades CSV, região · status ACTIVE/INACTIVE/ON_LEAVE/SUSPENDED. Sem User ID cru.

409 `USER_EMAIL_EXISTS`.

#### Editar — `/employees/[id]`

Perfil + bloco Acesso: com login → e-mail readonly + link “Redefinir senha em Usuários” (ADMIN → `/settings/users/:userId`; MANAGER vê texto pedindo admin). Sem login → e-mail + senha obrigatórios (não dá para salvar sem criar o usuário).

**KPI painel:** Operacional, Paradas hoje, Km plan. hoje. Relacionamentos: Rota hoje, Veículo, Login. Ações: Editar funcionário, Ver agenda, Ver no mapa (`/map?employeeId=`).

**Estados:** `EMPLOYEE_ALREADY_HAS_LOGIN` se já tem login e envia password.

**Regra:** `Employee.status` = RH. Não misturar com Presence/Operational.

Ficha: [employees.md](screens/employees.md)

---

### 4.3 Veículos

#### Lista — `/vehicles`

**Papéis:** ADMIN, MANAGER.

**Colunas:** Placa, Modelo (marca + modelo), Status, Rota hoje, Motorista, Editar.

**KPI** (`GET /ops/vehicles/summary`): Total, Disponíveis, Em uso, Manutenção, Rotas hoje, Km plan., GPS live.

**Filtros:** `q` placa ou modelo.

**Estados:** empty “Nenhum veículo.”

#### Novo / Editar — `/vehicles/new`, `/vehicles/[id]`

Placa * (uppercase no submit) · marca, modelo, ano, combustível, consumo km/L, capacidade, odômetro · Status AVAILABLE / IN_USE / MAINTENANCE / INACTIVE.

**KPI painel:** Paradas hoje, Km plan., Km real, GPS live. Relacionamentos: Rota hoje, Motorista. Ações: Editar veículo, Ver rotas, Rota de hoje (se houver).

Erro típico: placa duplicada na empresa.

Ficha: [vehicles.md](screens/vehicles.md)

---

## 5. Execução (campo)

Trava comum: [§5.0](#50-trava-pwa--gps). Telas de campo **não** mostram Maps/Waze — navegação só no Rotas.

### 5.0 Trava PWA + GPS (overlay, sem rota própria)

**Onde:** `/field/my-route`, `/field/start/[id]`, `/field/tracking-status`, `/field/navigate`.

**Arquivo:** `FieldPwaLocationGate.tsx`

**Componentes:** dialog tela cheia `role=dialog` `aria-modal`. Sem botão “agora não”.

**Estados / fases**

| Phase | Título | CTA |
| --- | --- | --- |
| checking | Preparando o app de campo | “Verificando instalação e localização…” |
| need-pwa | Instale o Rotas | iOS: Compartilhar → Adicionar à Tela de Início; Android prompt: **Instalar e usar localização**; senão passos ⋮ Chrome |
| need-location | Ative a localização | **Permitir localização agora** |
| ready | — | libera children |
| HTTP LAN (inseguro) | — | **não** bloqueia; faixa **NÃO ESTÁ EM HTTPS**; GPS do browser continua indisponível |
| localhost / 127.0.0.1 | — | **não** trava instalação (dev PC) |

**Ações:** prompt nativo de instalar; `getCurrentPosition` / permissão GPS. Sem API.

**Fora de escopo:** conceder GPS sem aviso do sistema; GPS com app fechado.

Ficha: [field-pwa-gate.md](screens/field-pwa-gate.md)

---

### 5.1 Minha rota — `/field/my-route`

**Papéis:** EMPLOYEE (nav). API filtra rotas do funcionário.

**Arquivo:** `FieldMyRoutePage.tsx`

**Componentes:** gate (+ faixa HTTP se inseguro) → header (KPI dia + Status GPS) · erro `role=alert` · card Tracking HTTP se IN_PROGRESS · articles por rota (status, veículo, km/tempo, **mini-mapa** com polyline, paradas, botões).

**Informação:** Publicada / Em andamento · placa · duração/distância planejadas · N paradas · cliente + OS # — título. Sequência após Play = mais perto → mais longe.

**KPI:** `{N} rota(s) em dd/mm/aaaa` · `~duração` soma planned · km soma planned. Por rota: duração · distância · paradas.

**Filtros:** data implícita = hoje. Sempre inclui `IN_PROGRESS` de qualquer data (senão o bloqueio `ROUTE_ALREADY_ACTIVE` fica invisível). Poll ~15s + visibilitychange. Sem date picker.

**Ações**

| Ação | Condição | Efeito |
| --- | --- | --- |
| ▶ Iniciar rota | PUBLISHED e nenhuma IN_PROGRESS | `/field/start/:id` |
| Continuar navegação | IN_PROGRESS (do dia ou de outro dia) | `/field/navigate` |
| Concluir rota | IN_PROGRESS (do dia ou de outro dia) | `POST /routes/:id/complete` (“Concluindo…”) |
| Status GPS | sempre | `/field/tracking-status` |
| Ver agenda | empty | `/agenda` |

GPS: `watchPosition` + fila local → `POST /tracking/points`. Com Gravar viagem o badge mostra pontos enviados / fila. Card Minha rota: `GPS ativo · HH:MM:SS` ou mensagem da API.

**Estados:** “Carregando suas rotas…” · empty “Nenhuma rota para hoje (dd/mm/aaaa)…” · aviso “Conclua a rota em andamento…” · faixa âmbar se `IN_PROGRESS` de outro dia (card com Concluir visível) · error vermelho.

**Navegação:** publicar em `/routes` → esta tela → wizard → navigate.

Ficha: [field-my-route.md](screens/field-my-route.md)

---

### 5.2 Iniciar rota — `/field/start/[id]`

**Papéis:** EMPLOYEE; rota `PUBLISHED` do dia, sua.

**Arquivo:** `FieldStartRoutePage.tsx`

**Componentes:** ← Minha rota · H1 + KPI paradas/tempo/km · stepper 1…5 · mini-mapa Dark Matter + polyline menta (pessoa→carro) · card do passo.

**Passos**

| # | id | Conteúdo |
| --- | --- | --- |
| 1 | gps | pedido automático de GPS; em HTTP LAN **pula** (origem = 1ª parada) |
| 2 | summary | com GPS: pin **pessoa** + mais perto→mais longe + km; em HTTP: ordem planejada |
| 3 | vehicle | pin **carro**; `GET /field/vehicles?routeId=` |
| 4 | checklist | pin carro; Km inicial * · Combustível EMPTY…FULL * · Observação max 500 |
| 5 | confirm | pin carro; resumo placa, km, combustível, 1ª parada |

**KPI:** N parada(s) · duração planejada · distância planejada (da rota).

**Ações:** Continuar / Voltar · ▶ Iniciar rota → `POST /routes/:id/start` `{ vehicleId, startOdometerKm, startFuelLevel, startNotes?, latitude, longitude }` → `/field/navigate`.

**Estados:** “Preparando início da rota…” · erro sem rota + voltar · `ROUTE_ALREADY_ACTIVE` com data da rota travada + link “Ir para Minha rota e concluir” · gpsError vermelho · “Informe o km inicial do veículo.” · “Iniciando…” · success redirect. Já IN_PROGRESS → erro ao abrir.

Fichas: [field-start.md](screens/field-start.md) (canônica; `field-start-route.md` é duplicata curta)

---

### 5.3 Navegação GPS — `/field/navigate`

**Papéis:** EMPLOYEE com rota `IN_PROGRESS`.

**Layout:** `(field-nav)` — **sem** AppHeader/AppNav. 100dvh.

**Componentes:** mapa Carto Dark Matter · LineString menta **só até a próxima parada** · markers de todas as paradas · marker GPS = **carro** (heading + interpolação) · faixa instrução (próxima **virada** + rua + faixa/distância; superfície escura + tinta; Chegando em âmbar + `#121212`) · banner de marco com **OK** laranja · HUD · Encerrar (confirm) · botão alvo / Centralizar (follow).

**Mapa / follow:** com GPS, follow ligado por padrão — câmera acompanha o ícone interpolado (zoom ~16, look-ahead); arrastar desliga follow; toque simples não desliga; botão alvo religa e recentraliza. Sem GPS, overview da rota (`fitBounds`). A linha **menta** (`#2EE6C7`) nasce no carro e **não** continua depois do pin-alvo (paradas futuras só como pinos).

**HUD (só com GPS; senão `—`)**

| KPI | Origem |
| --- | --- |
| Tempo restante | km restantes ÷ velocidade GPS (ao vivo; parado = última boa ou ~30 km/h) |
| Km restantes | polyline a partir do GPS (não o total da viagem gravada) |
| ETA | agora + tempo restante |
| km/h | `coords.speed` (parado = 0) |

**Banner de manobra:** usa o próximo step “de verdade” (ignora `depart`/`continue`/`new name`/`notification`); rua = `name` \|\| `ref`; faixa = ícones `lanes` OSRM ou texto pelo `modifier`; distância até a virada. Estados Recalculando / erro / Chegando / Fora da rota não mudam.

Sem GPS: banner âmbar “Localização necessária” (HTTP inseguro / permissão negada / indisponível após fallback rede). TIMEOUT transitório não trava — seed coarse + GPS fino. “Chegando” (~80 m) e “Fora da rota” (~50 m; ignora accuracy pior) = UX, **não** prova de visita.

**Recálculo:** no 1º fix GPS (sempre) → `POST /routes/:id/reroute` com `reorderRemaining: true` (origem = GPS; pendentes mais perto → mais longe). Off-route sustentado (~2,5 s / 2 samples, cooldown 8 s) → mesmo endpoint com `reorderRemaining: false` (só redesenha). Banner “Recalculando…” durante a API; geometria velha (U-turn) não fica pintada.

**Ações:** Encerrar → `/field/my-route` (rota **permanece** IN_PROGRESS) · **Cheguei** (banner ~80 m) → `/field/visits/[id]` · arrastar mapa desliga follow (toque simples não) · botão alvo religa follow · GPS watch → tracking · reroute automático. `beforeunload` / popstate avisam.

**Estados:** “Abrindo navegação Rotas…” · timeout 20s + “Tentar de novo” · sem IN_PROGRESS + “Voltar para Minha rota” · Recalculando / erro de recálculo.

**Fora de escopo:** voz, trânsito, Maps/Waze. Check-in na tela da visita.

Ficha: [field-navigate.md](screens/field-navigate.md)

### 5.3b Visita (check-in) — `/field/visits/[id]`

**Papéis:** EMPLOYEE da visita.

**Layout:** `(field-nav)` sem chrome.

**Informação:** cliente, endereço snapshot, OS, status.

**Ações:** **Cheguei** → `POST /visits/:id/check-in` com GPS; Voltar à navegação.

**Estados:** loading · error · forbidden · success (já fez check-in) · idle (botão).

**Fora de escopo:** notas, foto, check-out.

Ficha: [field-visit.md](screens/field-visit.md)

---

### 5.4 Status GPS — `/field/tracking-status`

**Papéis:** EMPLOYEE.

**Informação:** Transporte HTTP (sem WebSocket) · Sessão ativa/inativa + rota + placa · App PWA vs aba · Permissão GPS granted/denied/prompt · hint da API.

**KPI:** N/A numérico — indicador binário.

**Ações:** ← Minha rota. Load: `GET /field/tracking-status` + `permissions.query`. Sem botão de iniciar tracking.

**Estados:** “Carregando…” · erro borda vermelha · “Geolocation não suportada”.

Ficha: [field-tracking-status.md](screens/field-tracking-status.md)

---

## 6. Administração

### 6.1 Empresa — `/settings/company`

**Papéis:** nav + PATCH só ADMIN. `GET /companies/me` autenticado.

**Campos:** razão * · fantasia · CNPJ (sem lookup automático nesta tela) · telefone, e-mail · CEP (8 dígitos → BrasilAPI + pin) · busca Nominatim · endereço texto · pin **opcional** (não bloqueia salvar; aviso se faltar) · Status ACTIVE/INACTIVE.

**KPI:** N/A. Pin alimenta origem de `/routes`.

**Ações:** Salvar `PATCH /companies/me`.

**Estados:** skeleton `h-40` · “Salvo com sucesso.” · FormError · 403 no save se não ADMIN.

**Navegação:** aviso do planejador se origem sem pin.

Ficha: [settings-company.md](screens/settings-company.md)

---

### 6.2 Usuários

#### Lista — `/settings/users`

**Papéis:** ADMIN.

**Colunas:** Nome, E-mail, Perfil, Status, Editar.

**KPI:** N/A (CRUD de acesso).

**Filtros:** `q` nome/e-mail → `GET /users?q=`.

**Estados:** empty “Nenhum usuário encontrado.”

#### Novo — `/settings/users/new`

Nome *, e-mail *, perfil (default EMPLOYEE), senha inicial *. `POST /users` → `/settings/users/:id`. Não cria Employee (usar `/employees/new` para campo).

#### Editar — `/settings/users/[id]`

Salvar: Nome, Perfil, Status ACTIVE/INACTIVE/SUSPENDED. Redefinir senha: `POST /users/:id/reset-password`. `lastLoginAt` existe no DTO e **não** é exibido. E-mail não editável.

Ficha: [settings-users.md](screens/settings-users.md)

---

## 7. Matriz de navegação

| De | Para | O que atravessa | Pré-requisito |
| --- | --- | --- | --- |
| `/login` | `/` ou `?next=` | cookies JWT | — |
| `/forgot-password` | `/reset-password?token=` | token no log API | — |
| `/account/change-password` | `/login?changed=1` | sessões revogadas | — |
| `/settings/company` | `/routes` | pin origem | ADMIN |
| `/employees` | `/routes` + `/field/*` | `userId` (login) | — |
| `/employees/[id]` | `/settings/users/:userId` | reset senha | ADMIN |
| `/vehicles` | `/routes` / start | AVAILABLE / checklist | — |
| `/customers` | `/map`, `/routes` | pin PostGIS | — |
| `/map` pin | `/services/new?customerId=` | cliente | ADMIN/MANAGER |
| `/map` pin | `/customers/[id]` | prontuário | — |
| `/map` pin | `/routes?customerId=` | adicionar à rota | ADMIN/MANAGER |
| `/` | `/map`, `/agenda`, `/routes` | mesmo `date` do snapshot | gestores |
| `/services` | `/agenda` | visitas com data | — |
| `/agenda` | `/services/[id]` | abrir OS | não EMPLOYEE |
| `/routes` publicar | `/field/my-route` | rotas PUBLISHED | — |
| `/field/my-route` | `/field/start/[id]` | rota PUBLISHED | nenhuma IN_PROGRESS |
| `/field/start/[id]` | `/field/navigate` | start + GPS + checklist | — |
| `/field/navigate` Encerrar | `/field/my-route` | rota segue IN_PROGRESS | — |
| `/field/my-route` Concluir | próxima rota | COMPLETED | — |
| GPS campo | `/map` gestor | poll `/tracking/live` | — |

---

## 8. Matriz de permissões (UI)

| Tela | ADMIN | MANAGER | SUPERVISOR | EMPLOYEE |
| --- | --- | --- | --- | --- |
| Login / senha | público / autenticado | idem | idem | idem |
| Início snapshot | sim | sim | sim | capa sem KPI empresa |
| Mapa + live | sim | sim | sim (sem criar OS) | não |
| Agenda | todas | todas | todas | próprias; sem Abrir OS |
| Serviços | CRUD | CRUD | leitura | não |
| Rotas publicar | sim | sim | preview só | não |
| Clientes | sim | sim | update sim | criar/ver; update não |
| Funcionários / Veículos | sim | sim | não | não |
| Empresa / Usuários | sim | não | não | não |
| Campo `/field/*` | não (nav) | não | não | sim |

Autorização efetiva é sempre no **backend**.

---

## 9. Como validar este PRD contra o software

1. `npm run dev` (raiz). Web :3000, API :3001.
2. Seed: ver `docs/DEV.md` (não repetir senha aqui se o guia mudar).
3. Percorrer a sidebar nas três áreas com ADMIN, depois SUPERVISOR e EMPLOYEE — conferir itens que somem.
4. Conferir cada empty/loading/erro das fichas (listas vazias, snapshot sem rotas, mapa sem pin, campo sem rota do dia).
5. Confirmar que **não** existem `/dashboard` nem `/settings/audit`. `/field/visits/[id]` existe para check-in (sem evidência).
6. KPI: desligar API `/ops/*` mentalmente — strip some ou “KPIs indisponíveis”; nunca número fictício.

Se o software ganhar tela nova: criar `docs/screens/{slug}.md` **e** incluir uma seção neste arquivo na mesma entrega.

---

## 10. Histórico deste PRD UX

| Versão | Data | Nota |
| --- | --- | --- |
| 0.9 | 29/08/2026 | Primeira consolidação tela a tela (componente, KPI, filtros, ações, estados, permissões, navegação) alinhada ao código v0.10.8 |
| 0.9.1 | 29/08/2026 | HTTP LAN no campo: tela libera com faixa NÃO ESTÁ EM HTTPS (software v0.10.9) |
| 0.9.2 | 29/08/2026 | Planejador: E = origem da empresa; 1, 2… = paradas (software v0.10.11) |
| 0.9.3 | 29/08/2026 | Iniciar rota em HTTP no celular: pula GPS, origem = 1ª parada (software v0.11.1) |
| 0.9.4 | 01/09/2026 | Check-in: `/field/visits/[id]` + Cheguei na nav (software v0.12.0) |
| 0.9.5 | 01/09/2026 | Navegação: LineString teal recorta na parada-alvo (software v0.12.1) |
