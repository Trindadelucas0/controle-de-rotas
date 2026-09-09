# PRD — Rotas

| Campo | Valor |
| --- | --- |
| Produto | **Rotas** — gestão de operações externas, rotas e visitas |
| Versão deste PRD | 1.7 |
| Data | 01/09/2026 |
| Software correspondente | v0.13.0 |
| Status | Em desenvolvimento — execução de visita com relatório e fotos; KPIs/dashboard ricos ainda pendentes |
| Origem | Visão consolidada do PRD 1.1 (`PRD.docx`) + estado real do repositório |
| Plataforma atual | Web + PWA (manifest) — sem app nativo |
| Arquitetura | Web-first / API-first / Mobile-ready (app nativo **não** existe) |
| UX tela a tela | **PRD UX/Funcional v0.9** — [`docs/PRD-UX-FUNCIONAL.md`](docs/PRD-UX-FUNCIONAL.md) (tela a tela) + fichas em `docs/screens/` |
| Design handoff | Wireframes ASCII + cores + fluxos — [`docs/PRD-DESIGN-HANDOFF.md`](docs/PRD-DESIGN-HANDOFF.md) (colar em outra IA; **não** substitui produto/UX) |

Este documento é a fonte canônica de **produto**. UX detalhada **tela a tela** (componente, KPI, filtros, ações, estados, permissões, navegação): [`docs/PRD-UX-FUNCIONAL.md`](docs/PRD-UX-FUNCIONAL.md). Fichas por rota: `docs/screens/`. Handoff visual (wireframes + paleta hex + comunicação entre telas): [`docs/PRD-DESIGN-HANDOFF.md`](docs/PRD-DESIGN-HANDOFF.md). Contratos técnicos: `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/DEV.md`. Hub: `DOCUMENTACAO-SISTEMA.md`. Planos: `docs/plans/`.

**Modelo canônico de domínio (1.3):**

```
Customer → ServiceOrder → Visit → RouteStop → Route → Employee + Vehicle
```

Endereço canônico permanece em `Customer`. Ao agendar, a `Visit` copia snapshot de rua/cidade/lat/lng (e demais campos de endereço usados na visita).

---

## 1. Visão do produto

O SAMUEL é um sistema multi-tenant para empresas com equipes externas: planejar, distribuir, executar, monitorar, medir e otimizar visitas em campo.

**Conceito central:** Planejar → Distribuir → Executar → Monitorar → Medir → Otimizar

**Proposta de valor:** não é “só um mapa”. O diferencial é conectar, no mesmo fluxo:

> Mapa + cadastro/prontuário do cliente + ordem de serviço + visita + funcionário + veículo + rota + GPS + evidência + custo + KPI

A experiência principal é orientada a mapa (visão operacional e **hub de planejamento**), mas o produto é o **sistema operacional da operação externa**.

### 1.1 Conceitos de produto (clarificações 1.3)

| Conceito | Significado | Status |
| --- | --- | --- |
| **Mapa como hub de planejamento** | Pin do cliente: criar OS, abrir prontuário, nearby, context card | Entregue (tema 20) |
| **Routing** | Traçado A→B→C **dentro do SAMUEL** (OSRM / fallback), distância e duração planejadas | Entregue (preview + persistir + publicar) |
| **Navigation** | Navegação curva a curva no SAMUEL (`/field/navigate`) | Entregue (PWA); Maps/Waze = alternativa |
| **Presence** (presença) | ONLINE via Redis TTL no live tracking | Parcial (online/stale no mapa e `/ops`) |
| **Operational** (operacional) | AVAILABLE / IN_ROUTE / IN_SERVICE / PARADO / OFFLINE no `/ops/snapshot` | Parcial (`IN_SERVICE` após check-in; some após check-out) |
| **Employee.status** | Continua sendo status de RH (`ACTIVE` \| `INACTIVE` \| …) | Entregue — **não** misturar com Presence/Operational |
| **Planned vs actual** | Rotas/paradas têm campos `planned*` e `actual*`; KM real ainda raro | Planejado preenchido; duração actual no Concluir |
| **Chatwoot / WhatsApp** | Comunicação externa | **Fora do MVP** (abstração INTERACTIONS reservada) |
| **KPIs (alvo, sem telas ainda)** | Ver §12.16 — KM/tempo planejado×real, taxa de conclusão, tempos; custos depois | Não implementado |

---

## 2. Problema

Operações externas hoje ficam fragmentadas:

- clientes em planilhas e sistemas diferentes;
- funcionários usando Google Maps/Waze isolados;
- gestor sem saber onde a equipe está;
- ausência de histórico confiável de visitas;
- KM, custo e produtividade difíceis de calcular;
- falta de evidência de que a visita aconteceu;
- rotas difíceis de reorganizar no meio do dia;
- clientes próximos não aproveitados no planejamento.

O SAMUEL centraliza essas operações em um único fluxo.

---

## 3. Objetivo

Permitir que a empresa planeje, distribua, execute e monitore visitas externas em uma única plataforma, respondendo a qualquer momento:

> Quem está fazendo o quê, onde está, para qual cliente vai, qual veículo usa, quanto já percorreu, quanto falta e qual foi o resultado da visita?

---

## 4. Público-alvo

Empresas com equipes em campo, incluindo: assistência técnica, manutenção, instalação, vendas externas, representantes, inspeção, cobrança, manutenção predial, telecom, energia, distribuidores, logística leve e serviços em geral.

**Usuários do sistema (papéis):**

| Papel | Quem é | O que precisa |
| --- | --- | --- |
| ADMIN | Dono / TI / responsável da empresa | Configurar empresa, usuários e acessos; criar OS e publicar rotas |
| MANAGER | Gestor / despachante | Mapa, cadastros, OS, agenda, rotas, acompanhamento |
| SUPERVISOR | Supervisor de equipe | Ver mapa, agenda e rotas (leitura); acompanhar operação |
| EMPLOYEE | Técnico / vendedor / campo | Cadastro de cliente; agenda própria; **Minha rota** (iniciar, navegar, concluir) |

---

## 5. Estado atual do produto (01/09/2026)

O que segue reflete o **código e as docs atuais**, não a visão completa. Nada abaixo é inventado. Detalhe UX: [`docs/PRD-UX-FUNCIONAL.md`](docs/PRD-UX-FUNCIONAL.md), §13 e `docs/screens/`. Mapa interativo de telas/botões: canvas da sessão (não é fonte oficial).

### 5.1 Já entregue (temas 00–11 + 17–20)

| Capacidade | Onde |
| --- | --- |
| Login, logout, refresh, “esqueci senha”, alterar senha | `/login`, `/forgot-password`, `/reset-password`, `/account/change-password` |
| RBAC + isolamento `companyId` | API + guards Nest |
| Empresa (pin origem), usuários, funcionários (login de campo), clientes (pin obrigatório), veículos | `/settings/*`, `/employees`, `/customers`, `/vehicles` |
| Lookups CNPJ/CEP/endereço | `GET /api/v1/lookups/*` |
| Mapa hub + pin ao vivo + context card + nearby + roster Equipe | `/map` |
| Centro de Operações (snapshot do dia) + sidebar Operação/Recursos/Administração | `/`, `GET /ops/snapshot` |
| OS, agenda, rotas (modo Clientes + Visitas; várias rotas no dia) | `/services`, `/agenda`, `/routes` |
| Campo: Minha rota, wizard início, navegação tela cheia, status GPS, check-in, relatório, foto, check-out | `/field/my-route`, `/field/start/[id]`, `/field/navigate`, `/field/tracking-status`, `/field/visits/[id]` |
| Tracking HTTP (Redis atual + PostGIS histórico); start/complete/reroute | `POST /tracking/points`, `POST /routes/:id/start\|complete\|reroute` |
| PWA instalável (`start_url` campo) | Web |
| Health + audit auth (sem tela) | `/health`, `audit_logs` |

### 5.2 Ainda não existe (resto do MVP)

Não há: ranking/custos no dashboard, UI de auditoria, WebSocket de posição, object storage S3, e-mail transacional, signup self-service, MFA, app nativo, Chatwoot/WhatsApp, tabela `customer_interactions`. Check-in, check-out, relatório e foto local **entregues** (v0.13.0).

A home (`/`) é o **Centro de Operações** para gestores (tema 20); EMPLOYEE vê capa simples. Tema 14 enriquecerá a mesma home (não cria `/dashboard` paralelo nesta fase).

### 5.3 Limitação conhecida do que já existe

- Recuperação de senha: URL no **log da API** (sem SMTP).
- Empresa via **seed**; sem onboarding comercial.
- CNPJ sem checksum; sem lookup CPF; sem import CSV.
- Check-out e evidência de visita **implementados** (v0.13.0). Fotos em disco local (`STORAGE_DIR`), não S3.
- `actualDistanceMeters` ainda nasce null; `actualDurationSeconds` preenche no Concluir.
- Tracking some se o app for para background (limitação PWA).
- “Chegando” (~80 m) na nav é UX, **não** prova de visita.
- Nearby na UI sem ETA OSRM (só distância).
- Encerrar no mapa de navegação **não** conclui a rota — só **Concluir rota** em Minha rota.

---

## 6. Decisão de plataforma

| Decisão | Detalhe | Status |
| --- | --- | --- |
| Cliente gestor/admin | Web (Next.js) | Entregue (cadastros + mapa + planejamento) |
| Cliente funcionário | **PWA no celular** (mesmo frontend) | Manifest + Minha rota + navegação GPS |
| App nativo | Fora do MVP | Não iniciado |
| Localização | Geolocation do browser → API HTTPS | Entregue (iniciar rota habilita GPS; HTTP LAN = faixa, GPS bloqueado) |
| Background GPS | Limitação do browser; app nativo depois | Fora do MVP |

**Por que PWA no MVP:** valida o ciclo operacional sem app store; força a API a ser o contrato; HTTPS é obrigatório para geolocation em produção.

---

## 7. Perfis e permissões (RBAC)

Autorização **sempre no backend**. Nenhum usuário acessa dados de outra empresa.

| Role | Uso principal | O que já pode fazer hoje |
| --- | --- | --- |
| `ADMIN` | Configuração + operação | Empresa, usuários, funcionários, clientes, veículos, mapa, geocode, **criar/editar OS**, agenda, **preview/salvar/publicar rotas** |
| `MANAGER` | Operação e cadastros | Funcionários, clientes, veículos, mapa, geocode, **criar/editar OS**, agenda, **preview/salvar/publicar rotas** |
| `SUPERVISOR` | Acompanhamento (leitura) | Clientes, mapa, **agenda**, **rotas (leitura/preview)**; sem geocode, sem frota/equipe, **sem** criar OS nem publicar rotas |
| `EMPLOYEE` | Campo | Listar/criar/ver clientes; **agenda própria**; **Minha rota / Play / navegar / concluir**; **sem** `/routes`, mapa, funcionários, veículos, settings |

Regras futuras (não implementadas): check-in/out, evidência, “em atendimento” real.

---

## 8. Multi-tenancy

SaaS multi-tenant. Toda entidade operacional possui `companyId`. Isolamento obrigatório em queries e autorização.

**Hoje:** uma empresa seed (`Demo Samuel`). Não há painel super-admin da plataforma nem signup público.

**Não implementado:** RLS no Postgres (isolamento hoje é aplicação + JWT). Documentado em `docs/SECURITY.md`.

---

## 9. Fluxos principais

### 9.1 Gestor (backoffice web)

**Já funciona:**

```
Login → Centro de Operações (`/`)
  → Mapa hub (pins + live + context + nearby)
  → Empresa / Usuários / Funcionários / Veículos
  → Cadastrar cliente (CNPJ/CEP/rua → pin no mini-mapa; salvar exige pin)
  → Criar OS → agendar visitas → Agenda
  → /routes: clientes ou visitas → preview (OSRM) → publicar
  → Monitorar GPS ao vivo no mapa (poll HTTP)
```

**Ainda não funciona:**

```
Monitorar GPS em tempo real → Ajustar rota no dia
  → Check-in / evidência / check-out
  → Histórico real, KM real e KPIs no dashboard
  → Deep-link Maps/Waze (navigation)
```

### 9.2 Funcionário (PWA)

**Já funciona:**

```
Login → capa `/` (Minha rota / Agenda / Clientes)
  → Minha rota (`PUBLISHED` do dia + qualquer `IN_PROGRESS`)
  → Wizard Iniciar (GPS / veículo / km / combustível)
  → Navegar (`/field/navigate`) — curva a curva no Rotas
  → Encerrar volta a Minha rota (rota segue IN_PROGRESS)
  → Concluir rota (POST complete)
  → GPS a cada 5 s aparece no mapa do gestor (poll 3 s)
```

**Ainda não funciona:**

```
Cheguei (check-in) → relatório + foto → check-out → próxima parada ou remarcar
  → Maps/Waze como navegação principal
  → GPS com o app em background
```

### 9.3 Fluxo de valor do MVP (coração do produto)

```
Cadastrar cliente (CNPJ/CEP/rua/clique) → Pin no mapa   ← entregue
  → Criar OS → Visitas → Agenda → Rota (preview/persist/publish)  ← entregue (07–09)
  → Funcionário inicia rota (PWA) → GPS no mapa         ← entregue (10–11, HTTP)
  → Check-in → relatório + evidências → check-out          ← entregue (12–13)
  → Finalizar rota → Dashboard (KM / status)            ← Concluir entregue; KPI rico pendente (14)
  → Custos / KPIs ricos                                 ← pendente (15)
```

---

## 10. Escopo por fase

### 10.1 Fundação (entregue) — temas 00–06 e 06b

- Autenticação (login, logout, recuperação/alteração de senha, sessão, refresh token, RBAC)
- Empresas, usuários, funcionários, clientes, veículos
- Cliente inteligente: CNPJ/CEP (BrasilAPI) e busca de endereço (Nominatim); pin no mini-mapa; lat/lng não digitáveis; salvar exige localização
- Geocoding de endereço → lat/lng; status `OK` / `PENDING` / `FAILED`
- Mapa operacional de clientes (filtros básicos, pin, painel lateral)
- PostGIS no cliente + busca por proximidade na API
- Health da API; PWA manifest

### 10.2 Planejamento (entregue) — temas 07–09

| Tema | Entrega | Status | Rotas |
| --- | --- | --- | --- |
| 07 | Ordens de serviço (OS) + visitas de planejamento | **Done** | `/services`, `/services/new`, `/services/[id]` |
| 08 | Agenda | **Done** | `/agenda` |
| 09 | Rotas persistidas (preview OSRM por `visitIds`, salvar, publicar) — **sem** execução de campo | **Done** | `/routes` |

### 10.3 MVP restante (ordem de produto)

| Tema | Entrega | Rotas |
| --- | --- | --- |
| **20** | Context Cards + Centro de Operações + mapa hub + sidebar | `/`, `/map`, `GET /ops/*` — **Done** |
| 12 | Visita completa: check-in, relatório, resultado, check-out | `/field/visits/[id]` — **Done** |
| 13 | Evidências (fotos + storage local) | integrado em `/field/visits/[id]` — **Done** |
| 14 | Dashboard operacional (enriquece a **mesma** home `/`) | `/` (não `/dashboard` paralelo) |
| 21 | Enriquecimento: prontuário tabs, OS/agenda/rotas ricas, fichas funcionário/veículo | várias telas existentes |
| 16 | Auditoria UI | `/settings/audit` |
| 15 | Custos e KPIs financeiros (R$/km) | home + settings |

Temas 10+11+17+18+19 (campo/GPS/dispatch) já entregues — ver changelog.

Também comprometidos e ainda sem código:

- WebSocket de posição
- Offline limitado completo
- Deep-link Maps/Waze como UX principal (já há alternativa nas paradas)

### 10.4 Fase 2 (pós-MVP próximo)

- Custos e combustível (estimado e depois real) — alinhado ao tema 15
- KPIs mais ricos (funcionário, veículo, cliente, rota)
- Rota dinâmica (adicionar/remover parada no dia)
- Replay de rota (planejado × real)
- Notificações web
- Formulário de visita fixo por tipo (ainda sem builder)
- Sugestão simples de sequência (não VRP completo)
- E-mail transacional (reset de senha e avisos)
- RLS no Postgres
- UI de auditoria de ações críticas

**Nota:** “clientes próximos” (`ST_DWithin`) já está na API (tema 06). Planejamento de rota por visitas (tema 09) já consome coordenadas das visitas.

### 10.5 Fora de escopo do MVP

- App nativo, GPS em background real, push nativo
- **Chatwoot / WhatsApp** (comunicação externa)
- Geofencing avançado, alertas sofisticados
- VRP / VRPTW, otimização automática premium
- Formulários configuráveis (builder), assinatura digital avançada
- Portal do cliente
- IA, previsão de demanda, copiloto do gestor
- Telemetria veicular, API pública, SSO, MFA
- Signup self-service / billing SaaS / super-admin da plataforma

---

## 11. Arquitetura (produto)

```
Usuário (navegador / PWA)
        ↓
Web Next.js (apps/web :3000)
        ↓  cookies httpOnly
API NestJS /api/v1 (apps/api :3001)
        ├── PostgreSQL 16 + PostGIS (porta 5433)
        └── Redis 7 (sessão/rate limit; futuro: posição atual)
```

**Stack real hoje**

| Camada | Tecnologia |
| --- | --- |
| Web | Next.js 15, React, TypeScript, Tailwind, PWA (manifest) |
| Mapa | MapLibre GL JS + tiles raster OpenStreetMap (**sem token**) |
| Geocoding / endereço | Nominatim (OpenStreetMap) |
| CNPJ / CEP | BrasilAPI (proxy autenticado na Nest, cache Redis) |
| Routing | OSRM (env `OSRM_URL`; fallback nearest-neighbor + 2-opt) |
| API | NestJS + Prisma |
| Banco | PostGIS `postgis/postgis:16-3.5` |
| Cache | Redis 7 |
| Auth | JWT em cookies httpOnly + refresh opaco no banco |

**Planejado, não implementado:** object storage (fotos), WebSocket, workers/filas (BullMQ), navigation deep-link.

### Princípios

1. **API First** — regra de negócio no backend.
2. **Mobile Ready** — PWA e futuro app consomem a mesma API; nunca banco direto do cliente.
3. **Multi-Tenant** — `companyId` em tudo operacional.
4. **Geo Native** — PostGIS faz parte do domínio.
5. **Realtime** — localização atual via Redis; mapa faz poll HTTP (WebSocket ainda não).
6. **Auditável** — ações críticas com histórico. *(auth já grava; check-in de visita ainda não)*
7. **Modular** — clientes, mapa, OS, visitas, rotas e veículos como módulos independentes.

### Separação geoespacial

| Camada | Responsabilidade | Status |
| --- | --- | --- |
| PostGIS | Dados geográficos, proximidade | Entregue para **clientes** (+ geometria planejada de rota) |
| Tiles do mapa | Renderização (MapLibre + CARTO Voyager) | Entregue |
| Geocoding | Endereço → coordenadas (Nominatim + CEP/CNPJ) | Entregue |
| Routing | Sequência / distância / duração / LineString no SAMUEL | Entregue (planejado); actual KM pendente |
| Tracking | GPS do PWA → `POST /tracking/points` + Redis live | Entregue (HTTP; sem WebSocket) |
| Navigation | Curva a curva em `/field/navigate` | Entregue; Maps/Waze só alternativa |

### Três estados geográficos (alvo)

| Estado | Onde | Uso | Status |
| --- | --- | --- | --- |
| Atual | Redis | “Onde está agora” | Entregue (`GET /tracking/live`) |
| Histórico | PostGIS | Replay, KM, auditoria | Parcial (pontos gravados; sem tela de replay) |
| Planejado | PostGIS (geometria + stops) | Comparar planejado × real | Parcial (planejado preenchido; KM actual null) |
| Cliente | PostGIS `Point` | Pin no mapa, nearby | Entregue |

---

## 12. Módulos funcionais

Legenda: **Entregue** · **Parcial** · **Planejado**

### 12.1 Autenticação — Entregue

Login, logout, recuperação e alteração de senha, sessão (access JWT + refresh), RBAC. MFA **não**. Reset de senha **sem e-mail** (URL no log em desenvolvimento).

### 12.2 Empresas — Parcial

Campos atuais: razão social, nome fantasia, documento, telefone, e-mail, endereço, pin de origem (lat/lng + PostGIS), status.

Não há: timezone, logo, configurações avançadas, onboarding self-service.

### 12.3 Usuários — Entregue (MVP de acesso)

Nome, e-mail, role, status, empresa, último login. Admin cria usuário e pode forçar reset de senha.

Não há: telefone/cargo no usuário (cargo fica no funcionário).

### 12.4 Funcionários — Entregue (cadastro)

Nome, telefone, e-mail, cargo, matrícula, status (`ACTIVE` \| `INACTIVE` \| `ON_LEAVE` \| `SUSPENDED`), especialidades (lista de strings), região, vínculo opcional com usuário.

`Employee.status` = RH. Presence (ONLINE/OFFLINE/GPS_*) e Operational (AVAILABLE/IN_ROUTE/…) são conceitos **documentados**, ainda sem campos/API.

Matching automático por especialidade: depois do MVP.

### 12.5 Clientes — Entregue (cadastro + geo + lookups)

Cadastro (documento, contatos, endereço, categoria, prioridade, observações, status) + `geometry(Point, 4326)` PostGIS sincronizado a partir de lat/lng.

**Endereço canônico** fica no cliente. A visita **copia** street/city/lat/lng (snapshot) no momento do agendamento.

No formulário web (tema 06b):

- CNPJ com 14 dígitos dispara BrasilAPI e preenche dados + pin quando houver endereço.
- CEP com 8 dígitos dispara BrasilAPI e preenche endereço + pin.
- Busca de rua (debounce) dispara Nominatim (até 5 sugestões) e posiciona o pin.
- Clique e arraste no mini-mapa definem o local. Lat/lng **não** são campos digitáveis.
- Salvar **exige** pin. Sem localização, o backend/UI bloqueiam o cadastro.

`locationStatus`: `OK` se houver coordenadas; senão `PENDING` / `FAILED`.

Não há: checksum de CNPJ, lookup de CPF, tabelas separadas de contatos/endereços múltiplos, importação CSV.

### 12.6 Mapa — Entregue (hub + live HTTP)

Mapa mostra **clientes** geocodificados e **carros ao vivo** (poll `GET /tracking/live` 3 s). Clique no pin do cliente abre painel: dados, **criar OS**, prontuário, **adicionar à rota**, nearby. Faixa **Equipe** (☰ no celular): todos ACTIVE+login; drawer com placa, GPS, rota e paradas. **Ver no mapa** pinta o LineString. Filtros: busca, status, data do snapshot, funcionário (`?employeeId=`).

Ainda não: WebSocket, Chatwoot, ETA OSRM, “em atendimento” real, pintar vários funcionários juntos.

### 12.7 Prontuário — Parcial

Hoje o “prontuário” é a ficha do cliente (cadastro + coordenadas) + entrada a partir do mapa. Falta consolidar linha do tempo completa de OS/visitas/evidências.

### 12.8 Ordens de serviço (ServiceOrder) — Entregue (planejamento)

OS ligada a um cliente; gera/recebe visitas. Prioridade: `LOW` \| `NORMAL` \| `HIGH` \| `URGENT`.

**Status da OS (não há `IN_ROUTE` na OS):**  
`OPEN` · `IN_PROGRESS` · `COMPLETED` · `CANCELLED`

Telas: `/services`, `/services/new`, `/services/[id]`. Criação/edição: ADMIN, MANAGER.

### 12.9 Agenda e visitas (planejamento) — Entregue (parcial quanto à execução)

Agenda dia com visitas. EMPLOYEE vê apenas as próprias.

**Status de planejamento da Visit:**  
`SCHEDULED` · `ASSIGNED` · `CANCELLED` · `RESCHEDULED`

**Enums de execução** (existem no schema, **não acionáveis** sem check-in — temas 12+):  
`IN_ROUTE` · `ARRIVED` · `IN_PROGRESS` · `COMPLETED` · `FAILED`

Snapshot de endereço na visita: street, number, complement, district, city, state, zipCode, latitude, longitude.

### 12.10 Veículos — Entregue (cadastro)

Marca, modelo, ano, placa, combustível, consumo médio, capacidade, KM atual, status (`AVAILABLE` \| `IN_USE` \| `MAINTENANCE` \| `INACTIVE`). Placa única por empresa.

Associação rota ↔ funcionário + veículo: entregue no módulo de rotas (tema 09).

### 12.11 Rotas e paradas — Entregue (planejamento + start/complete)

Modelo: `Visit` → `RouteStop` → `Route` → `Employee` + `Vehicle`.

Rota: empresa, data, funcionário, veículo, origem (empresa), sequência de visitas, distância/duração **planejadas**, geometria planejada, status.

**Status rota:** `DRAFT` · `PLANNED` · `ASSIGNED` · `PUBLISHED` · `IN_PROGRESS` · `COMPLETED` · `CANCELLED`

Cada `route_stops` aponta para uma visita (sequência, planned distance/duration, lat/lng, status `PENDING` \| `SKIPPED` \| `COMPLETED` \| `FAILED`).

**Fluxo entregue:** preview → salvar → publicar → **start** (wizard PWA) → navegar / reroute → **complete**.

**Não entregue nesta seção:** actual KM (`actualDistanceMeters` ainda null); `actualDurationSeconds` preenche no Concluir. Check-in de visita: §12.13.

### 12.12 Tracking — Entregue (HTTP; WebSocket pendente)

Inicia quando o funcionário **inicia a rota** (habilita GPS). Posição atual no Redis (`GET /tracking/live`); pontos via `POST /tracking/points` (campo a cada 5 s). Histórico PostGIS. **Não há** WebSocket `employee.location.updated` — o mapa do gestor faz poll HTTP 3 s.

**Limitação:** o browser não rastreia em background como app nativo. Visita **não** é prova só porque o GPS entrou no raio do cliente — combinar GPS + horário + ação manual + evidência.

### 12.13 Visitas (execução) — Entregue (temas 12 + 13, v0.13.0)

Check-in (“Cheguei — chegada verificada”) com GPS; relatório fixo (resultado, observações, fotos); check-out com GPS. Outcomes: `DONE`, `NO_CONTACT`, `REFUSED`, `FOLLOW_UP`. Remarcar cria visita `ASSIGNED` na Agenda. Gestor lê em `/services/[id]`.

### 12.14 Evidências — Entregue (storage local)

Fotos JPEG/PNG/WebP em `STORAGE_DIR`; metadados em `visit_evidence`; download autenticado. S3 = fase 2.

### 12.15 Custos e combustível — Planejado (tema 15 / Fase 2)

Estimativa: `KM / consumo médio = litros` → `litros × preço = custo`. Depois abastecimentos reais. KPIs de custo: custo/visita, custo/cliente, custo/rota, custo/km.

### 12.16 Dashboard e KPIs — Planejado (tema 14)

**Alvo (não implementar telas neste PRD — lista de produto):**

- KM planejado × real + desvio %
- Tempo planejado × real + desvio %
- Visitas planejadas × concluídas (taxa de conclusão)
- Tempo de deslocamento / atendimento / ociosidade
- Depois (tema 15): custo/visita, custo/cliente, custo/rota, custo/km

**MVP do dashboard:** operação atual quando Presence/Operational existirem; visitas e KM planejado/real.

### 12.17 Notificações — Fase 2+

Nova rota, rota alterada, serviço atribuído, visita cancelada/atrasada. Canais futuros: web, e-mail, WhatsApp, push.

### 12.18 Auditoria — Parcial

Banco `audit_logs` existe. Eventos atuais: `USER_LOGIN`, `USER_LOGOUT`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `PASSWORD_CHANGED`.

Tela `/settings/audit` e eventos de rota/visita/cliente: **depois** dos temas 10–15 (não é mais o tema 12).

### 12.19 Comunicação — Fora do MVP

Chatwoot / WhatsApp **fora do MVP**. Não entram no mapa nem no prontuário nesta fase.

---

## 13. Telas — PRD UX/Funcional v0.9 (tela por tela)

Documento único com **todas as telas existentes** no nível de componente, informação, KPI, filtros, ações, empty/loading/erro, permissões e navegação:

**[`docs/PRD-UX-FUNCIONAL.md`](docs/PRD-UX-FUNCIONAL.md)**

Fichas por rota (mesmo conteúdo, recorte por arquivo): **`docs/screens/{slug}.md`**.  
Chrome compartilhado (AppHeader + sidebar **Operação · Recursos · Administração**): [home-shell.md](docs/screens/home-shell.md).  
Wireframes ASCII + mapa de cores + fluxos para handoff de design/UX: **[`docs/PRD-DESIGN-HANDOFF.md`](docs/PRD-DESIGN-HANDOFF.md)** (não inventa comportamento).  
Middleware só exige cookie; papel = nav + botões + API 403.

### 13.0 Regra anti-CRUD (UX v1.0)

Entidades operacionais (**Cliente, Funcionário, Veículo, OS, Agenda, Rotas**) seguem:

```
Lista → KPI strip (API) → Filtros → Tabela enriquecida → Detalhe → Resumo + Timeline + Relacionamentos + Ações
```

- KPI sem dado na API = não renderizar ou `—` (nunca placeholder inventado).
- Auth simples (`/login`, senha) permanece formulário — sem KPI.
- Quatro áreas de IA: **Operação** · **Recursos** · **Execução** · **Administração**.
- Plano de entrega: [20-paineis-operacionais.md](docs/plans/20-paineis-operacionais.md).

### 13.1 Inventário atual

| Rota | Objetivo | Papéis | KPI na UI | Ficha |
| --- | --- | --- | --- | --- |
| `/login` | Entrar | Público | N/A | [login.md](docs/screens/login.md) |
| `/forgot-password` | Pedir reset | Público | N/A | [forgot-password.md](docs/screens/forgot-password.md) |
| `/reset-password` | Nova senha (token) | Público | N/A | [reset-password.md](docs/screens/reset-password.md) |
| `/` | Centro de Operações (gestor) / capa (EMPLOYEE) | Autenticado | Equipe · visitas · rotas · alertas | [home.md](docs/screens/home.md) |
| `/account/change-password` | Trocar senha | Autenticado | N/A | [change-password.md](docs/screens/change-password.md) |
| `/settings/company` | Empresa + pin origem | ADMIN | N/A | [settings-company.md](docs/screens/settings-company.md) |
| `/settings/users` · `/new` · `/[id]` | Acessos | ADMIN | N/A | [settings-users.md](docs/screens/settings-users.md) |
| `/employees` · `/new` · `/[id]` | Equipe + login campo | ADMIN, MANAGER | Summary `/ops/employees/summary` + rota/live na lista | [employees.md](docs/screens/employees.md) |
| `/customers` · `/new` · `/[id]` | Clientes + prontuário | Todos (update SUPERVISOR+) | Summary `/ops/customers/summary` + OS/visita na lista | [customers.md](docs/screens/customers.md) |
| `/vehicles` · `/new` · `/[id]` | Frota | ADMIN, MANAGER | Summary `/ops/vehicles/summary` + rota/motorista | [vehicles.md](docs/screens/vehicles.md) |
| `/map` | Hub operacional + live + context | ADMIN, MANAGER, SUPERVISOR | Equipe · visitas · ao vivo | [map.md](docs/screens/map.md) |
| `/services` · `/new` · `/[id]` | Ordens de serviço | ADMIN, MANAGER (SUPERVISOR leitura) | Summary `/ops/service-orders/summary` | [services.md](docs/screens/services.md) |
| `/agenda` | Visitas do dia | Todos (EMPLOYEE: próprias) | Summary `/ops/agenda/summary` | [agenda.md](docs/screens/agenda.md) |
| `/routes` | Rotas de hoje + planejador (`?customerId=`) | ADMIN, MANAGER (SUPERVISOR preview) | Summary `/ops/routes/summary` + aba Hoje | [routes.md](docs/screens/routes.md) |
| `/field/my-route` | Capas do dia (trava PWA+GPS) | EMPLOYEE | N rotas · tempo/km do dia | [field-my-route.md](docs/screens/field-my-route.md) · [field-pwa-gate.md](docs/screens/field-pwa-gate.md) |
| `/field/start/[id]` | Wizard início | EMPLOYEE | Paradas · planned | [field-start.md](docs/screens/field-start.md) |
| `/field/navigate` | Nav GPS tela cheia | EMPLOYEE | HUD: tempo, km, ETA, km/h | [field-navigate.md](docs/screens/field-navigate.md) |
| `/field/visits/[id]` | Check-in da visita | EMPLOYEE | N/A | [field-visit.md](docs/screens/field-visit.md) |
| `/field/tracking-status` | Diagnóstico GPS | EMPLOYEE | Sessão ativa/inativa | [field-tracking-status.md](docs/screens/field-tracking-status.md) |

### 13.2 Contexto entre telas

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
| `/field/navigate` Cheguei | `/field/visits/[id]` | visita da parada (~80 m = aviso) | rota IN_PROGRESS |
| `/field/visits/[id]` Cheguei | permanece | GPS + check-in | EMPLOYEE da visita |
| `/field/my-route` Concluir | próxima rota | COMPLETED | — |
| GPS campo | `/map` gestor | poll `/tracking/live` | — |

### 13.3 Telas previstas (não existem)

| Rota | Tema | Objetivo |
| --- | --- | --- |
| `/field/visits/[id]` (notas, check-out, evidência) | 12–13 | completar execução da visita |
| `/field/visits/[id]/evidence` | 13 | fotos |
| (enriquecer `/`) | 14 | KPIs planejado × real na mesma home — **não** criar `/dashboard` paralelo no tema 14 |
| `/settings/audit` | 16 | UI de `audit_logs` |

## 14. Modelo de dados

### 14.1 Existe no Prisma hoje

`companies` · `users` · `employees` · `customers` (com `location` PostGIS) · `vehicles` · `service_orders` · `visits` (snapshot de endereço + check-in) · `visit_events` · `routes` · `route_stops` · `refresh_tokens` · `password_reset_tokens` · `audit_logs`

### 14.2 Conceitual — ainda não criado

`skills` / `employee_skills` · `customer_contacts` · `customer_addresses` · `customer_interactions` · `gps_positions` · `current_locations` (Redis) · `attachments` · `expenses` · `fuel_records` · `notifications` · `geofences` · `visit_forms`

Relacionamentos canônicos (1.3):

```
Customer → ServiceOrder → Visit → RouteStop → Route → Employee + Vehicle

Company → Users, Employees, Customers, Vehicles, ServiceOrders, Routes, Visits
Employee → Routes, Visits, GPS Positions (futuro)
Customer → ServiceOrders, Visits, Interactions (futuro), Attachments (futuro)
Route → Employee, Vehicle, RouteStops
RouteStop → Visit (1:1)
```

Geometrias: `POINT` (cliente, posição), `LINESTRING` (rota planejada), `POLYGON` (geofence futuro). SRID 4326. Índice GIST em `customers.location` **já existe**.

---

## 15. API

Base: `/api/v1`. Erro padrão:

```json
{ "statusCode": 401, "code": "AUTH_INVALID_CREDENTIALS", "message": "E-mail ou senha inválidos." }
```

Escopo de negócio: sempre `companyId` do JWT.

### 15.1 Endpoints existentes

```
GET     /health
POST    /auth/login | /auth/refresh | /auth/logout
GET     /auth/me
POST    /auth/forgot-password | /auth/reset-password
PATCH   /auth/change-password
GET     /companies/me
PATCH   /companies/me
GET|POST          /users
GET|PATCH         /users/:id
POST              /users/:id/reset-password
GET|POST          /employees
GET|PATCH|DELETE  /employees/:id
GET|POST          /customers
GET|PATCH|DELETE  /customers/:id
POST              /customers/:id/geocode
GET               /lookups/cnpj/:cnpj
GET               /lookups/cep/:cep
GET               /lookups/address?q=
GET|POST          /vehicles
GET|PATCH|DELETE  /vehicles/:id
GET     /map/customers
GET     /map/customers/nearby
GET|POST          /service-orders
GET|PATCH         /service-orders/:id
POST              /service-orders/:id/cancel
POST              /service-orders/:id/visits
GET               /visits
GET|PATCH         /visits/:id
POST              /visits/:id/check-in
POST              /routes/preview
POST              /routes
POST              /routes/:id/publish
POST              /routes/:id/start | /complete | /reroute
POST              /tracking/points
GET               /tracking/live
GET               /field/my-route | /field/vehicles | /field/tracking-status
GET               /ops/snapshot
GET               /ops/{customers|employees|vehicles|service-orders|routes|agenda}/summary
```

Contratos: `docs/API.md` e `docs/modules/`.

### 15.2 Endpoints-alvo ainda inexistentes

```
POST                   /api/v1/visits/:id/check-out
GET                    /api/v1/dashboard          (não criar; enriquecer GET /ops e a home /)
```

WebSocket alvo (ainda não): `employee.location.updated` · `route.started|updated|completed` · `visit.started|completed`

---

## 16. Segurança e LGPD

### 16.1 Implementado

- Senha com bcrypt
- Access JWT e refresh opaco (hash SHA-256 no banco, rotação)
- Cookies httpOnly, SameSite=Lax; Secure se `COOKIE_SECURE=true`
- Rate limit Redis no login e no forgot-password; lookups com cache Redis e tratamento de 429 da BrasilAPI/Nominatim; rate limit em `/routes/preview`
- CORS restrito a `CORS_ORIGIN` (sem `*`)
- Validação de input no backend (class-validator)
- Segredos só em `.env` (não no frontend)
- Isolamento por `companyId` nas queries operacionais
- Auditoria de eventos de autenticação (sem senha no metadata)

### 16.2 Não implementado

MFA · RLS Postgres · HTTPS de produção (depende de deploy) · object storage com ACL · retenção configurável de GPS · tela de auditoria · e-mail transacional.

### 16.3 LGPD (orientação de produto)

Finalidade clara do rastreamento · política de retenção configurável · auditoria · segregação · transparência. O cliente da plataforma define bases legais e políticas trabalhistas com assessoria própria. O SAMUEL **não** deve vender “prova absoluta” só com geofence.

Localização de funcionários é dado sensível: quando o tracking existir, o acesso deve ser restrito a papéis operacionais da mesma empresa.

---

## 17. Critérios de aceite do MVP

| # | Critério | Status |
| --- | --- | --- |
| 1 | Empresa é provisionada e o admin entra no sistema | Parcial (seed; sem signup) |
| 2 | Admin cria usuários, funcionários e veículos | Entregue |
| 3 | Clientes são cadastrados, geocodificados e aparecem no mapa | Entregue |
| 4 | OS são criadas; gestor monta e atribui rota com distância/duração (preview + persistir + publicar) | Entregue (planejamento) |
| 5 | Funcionário, na PWA/HTTPS, vê a rota, inicia e envia localização | Entregue (HTTP; HTTPS exigido para GPS real no celular) |
| 6 | Gestor vê a localização atualizar no mapa (WebSocket) | Parcial (poll HTTP 3 s; sem WebSocket) |
| 7 | Funcionário faz check-in, registra visita, anexa foto e finaliza | Parcial (check-in WP1; notas/foto/check-out pendentes) |
| 8 | Rota é concluída; histórico e KM reais ficam consultáveis | Parcial (Concluir + duração actual; KM real ainda null) |
| 9 | Dashboard mostra indicadores mínimos de status/visitas/KM | Parcial (Centro de Operações; sem planejado×real rico) |
| 10 | Dados de uma empresa não vazam para outra | Entregue (via JWT/queries; RLS ainda não) |

O MVP **não** está completo. Fundação + planejamento + execução GPS (1–6 e 10, com ressalvas) estão no ar; check-in/evidência/KPIs ricos (7–9) são o próximo bloco (temas 12–15).

---

## 18. Prioridades de desenvolvimento

| Prioridade | Itens | Situação |
| --- | --- | --- |
| P0 feito | Auth, cadastros, mapa, OS, agenda, rotas, execução PWA + GPS HTTP | Entregue |
| P0 restante | Check-in/out, evidências | Temas 12–13 |
| P1 | Dashboard planejado×real, fotos/storage, WebSocket | Temas 14 + infra |
| P2 | Custos/KPIs ricos, geofencing, alertas, formulários, e-mail, UI auditoria | Tema 15 + pós-MVP |
| P3 | Chatwoot/WhatsApp, IA, otimização avançada, telemetria, app nativo, portal do cliente | Longo prazo / fora do MVP |

**Próximo bloco de produto:** tema **12** — check-in/out da visita. Encerrar no mapa **não** substitui Concluir rota.

---

## 19. Roadmap de longo prazo

1. Fundação (mapa + clientes + cadastros) — **feito**
2. OS + agenda + rotas (planejamento) — **feito**
3. Visitas em execução + GPS (temas 10–13)
4. KPIs + custos (temas 14–15)
5. Comunicação + WhatsApp + portal (pós-MVP; Chatwoot fora do MVP)
6. Otimização automática
7. IA + previsão + recomendações
8. Mobile nativo + telemetria + ecossistema

Objetivo final: o sistema responder automaticamente quem atende, em que ordem, com qual veículo, a que custo, onde está, quando chega, se o serviço foi executado e como reduzir o custo da próxima rota.

---

## 20. Regras de ouro do produto

1. Visita concluída ≠ “GPS entrou no endereço”.
2. Rota executada ≠ “rota foi criada” (nem “rota foi publicada”).
3. Funcionário ativo (RH) ≠ Presence/Operational; diferenciar: app aberto, GPS ativo, em movimento, parado, em atendimento, offline.
4. Não começar pelo dashboard cheio de gráficos antes do fluxo de execução.
5. Não misturar mapa, routing, tracking, navigation e CRM em um único módulo monolítico.
6. Não armazenar GPS indefinidamente sem retenção.
7. Não usar Postgres como barramento de tempo real da localização atual.
8. Não afirmar que uma proteção, integração ou tela existe se não estiver no código.
9. Routing (linha no SAMUEL) ≠ Navigation (Maps/Waze).
10. Chatwoot/WhatsApp não entram no MVP.

---

## 21. Métricas de produto (orientação)

**Operacionais (alvo):** visitas/dia, visitas/funcionário, KM/dia, tempo médio de visita e deslocamento, taxa de conclusão, desvio % KM/tempo planejado×real.

**Financeiras (tema 15):** custo/km, custo/visita, custo/cliente, custo/rota, custo/funcionário.

**Produto (já mensuráveis em parte):** usuários ativos, clientes cadastrados, clientes com localização `OK`, uso do mapa, OS criadas, rotas publicadas, visitas na agenda.

**Ainda não mensuráveis:** rotas executadas, tracking ativo, check-in/out, evidências — dependem dos temas 10–13.

---

## 22. Requisitos não funcionais

| Tema | Requisito | Status |
| --- | --- | --- |
| Disponibilidade local | `npm run dev` sobe Docker + API + Web | Entregue |
| Portas | Web 3000, API 3001, PostGIS 5433, Redis 6379 | Entregue |
| Performance GPS | Atual em Redis; histórico em lote | Planejado |
| Mobile | Telas de cadastro, mapa, agenda e serviços usáveis ~375px | Parcial (planejamento sim; campo não) |
| Deploy produção | HTTPS, domínio, proxy, backups | Não identificado neste repositório |
| Testes automatizados de produto | Suíte E2E do fluxo de campo | Não implementado |

---

## 23. Fora de escopo (backlog não comprometido)

Ideias **fora** do MVP comprometido:

- Watermark de GPS/hora em fotos; confirmação de visita por SMS/WhatsApp; SLA e visitas recorrentes; territórios; importação CSV em lote; lookup de CPF; estoque de peças no veículo; comprovante PDF da visita.
- Planos/limites SaaS, super-admin da plataforma, white-label, webhooks, SSO, i18n PT/ES.
- Direito ao esquecimento / exportação LGPD; separação clara entre jornada/ponto e rastreamento operacional.
- ETA ao cliente; heatmap de cobertura; cartão combustível; OCR de evidências; despachante automático premium.
- Chatwoot embutido no mapa/prontuário.

---

## 24. Decisões de produto já tomadas

| Tema | Decisão |
| --- | --- |
| Cliente de campo no MVP | PWA + HTTPS (sem app nativo) |
| Mapa | MapLibre + OpenStreetMap (sem token Mapbox/Google); hub de planejamento (sem Chatwoot) |
| Geocoding / endereço | Nominatim; endereço canônico no Customer; snapshot na Visit |
| CNPJ / CEP | BrasilAPI via API autenticada (não chamar do browser direto) |
| Pin do cliente | Obrigatório para salvar; sem lat/lng digitável |
| Domínio | `Customer → ServiceOrder → Visit → RouteStop → Route → Employee + Vehicle` |
| Status da OS | `OPEN` \| `IN_PROGRESS` \| `COMPLETED` \| `CANCELLED` — sem `IN_ROUTE` |
| Status visita (planejamento) | `SCHEDULED` \| `ASSIGNED` \| `CANCELLED` \| `RESCHEDULED` |
| Routing vs Navigation | Routing = OSRM no SAMUEL; Navigation curva a curva = `/field/navigate` (Maps/Waze só alternativa) |
| Presence vs Operational vs HR | Conceitos separados; `Employee.status` permanece RH |
| Planned vs actual | Duração actual no Concluir; KM real ainda null |
| Visitas | Planejamento entregue; check-in/execução da visita depois (tema 12) |
| Formulários | Fixo no MVP; builder depois |
| Prova de visita | GPS + ação manual + evidência — nunca só geofence |
| Chatwoot | Fora do MVP |
| Próximo bloco | Tema 12 (check-in) |

O `PRD.docx` original não foi alterado. Este `PRD.md` é a fonte canônica.

---

## 25. Resultado esperado

**Hoje:** a empresa (seed) cadastra equipe, frota e clientes; cria OS e visitas; vê agenda; monta e publica rotas; o técnico inicia, navega e conclui no PWA; o gestor vê GPS no mapa (poll HTTP), com acesso isolado por papel e por tenant.

**Ao final do MVP:** o ciclo inclui check-in, evidência e planejado×real na mesma home — com arquitetura pronta para app nativo sem reescrever o backend.

---

## 26. Como validar este PRD contra o sistema

1. Subir com `npm run dev` (raiz do repositório).
2. Entrar em http://localhost:3000 com o usuário seed documentado em `docs/DEV.md`.
3. Percorrer o menu: Início, Mapa, Clientes, Serviços, Agenda, Rotas, Funcionários, Veículos, Empresa, Usuários.
4. Em `/customers/new`, confirmar que salvar sem pin é bloqueado e que CEP/CNPJ/busca de rua preenchem endereço e pin.
5. Fluxo gestor: criar OS com visitas → `/agenda` → `/routes` preview → publicar.
6. Fluxo campo (EMPLOYEE): `/field/my-route` → Iniciar → Play → Navegar → **Cheguei** (~80 m) → `/field/visits/[id]` → Cheguei (GPS) → Encerrar (rota segue em andamento) → **Concluir rota**.
7. Confirmar que **não** existem `/dashboard` nem `/settings/audit`. `/field/visits/[id]` existe só para check-in (sem foto/check-out).
8. Conferir `GET http://localhost:3001/api/v1/health` com `db`, `redis` e `postgis`.

Se o software avançar (tema 12+), atualizar a seção 5 e a tabela da seção 17 neste arquivo — não deixar o PRD descolar do código.
