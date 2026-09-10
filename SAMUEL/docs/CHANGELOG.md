# Changelog

## v0.16.18 — 2026-09-10

### Gravar viagem em todas as rotas do lote

- Antes: checkbox forçava só o 1º cliente (`ROUTE_RECORD_TRIP_SINGLE_CUSTOMER`)
- Agora: `recordTrip` com 1+ clientes; cada rota do dispatch herda a flag; trilha no Cheguei por cliente
- Reuso de geometria ACTIVE no planejamento continua só em rota de **1** parada
- Docs: hub §8, `API.md`, `screens/routes.md`, `modules/routes.md`

## v0.16.17 — 2026-09-10

### Fix — Trilha GPS no mapa (“Não foi possível carregar”)

- Sintoma: `/map?routeId=` mostrava “Não foi possível carregar a trilha GPS”
- Causa: `apps/api/dist` tinha árvore velha `dist/src/` (sem `GET /tracking/history`); Nest registrava só `points`/`live` → 404 na UI
- Correção: rebuild limpo do dist; `nest-cli.json` com `deleteOutDir: true`; banner da trilha mostra detalhe do `ApiError`
- Como validar: reiniciar API → log com `Mapped {/api/v1/tracking/history, GET}` → `/map?routeId=` de rota incompleta/concluída com GPS

## v0.16.16 — 2026-09-10

### Fix — `/map` “default is not a constructor” + syntax `/routes`

- Sintoma: `/map` com `TypeError: react_map_gl_maplibre.default is not a constructor`; `/routes` não compilava (`??` misturado com `||`)
- Causa: `import Map` sombreava o `Map` nativo em `OperationalMap`; `STATUS_LABEL[status] ?? status || '—'` sem parênteses
- Correção: import `MapGL` + `globalThis.Map`; `(STATUS_LABEL[status] ?? status) || '—'`
- Arquivos: `OperationalMap.tsx`, `FieldNavigatePage.tsx`, `RouteManagePanel.tsx`
- Como validar: `/map` e `/routes` abrem sem overlay/erro de build

## v0.16.15 — 2026-09-10

### Concluir rota — arrastar, incompleta, trilha congelada

- Campo: `SlideToComplete` + modal em Minha rota e Navegação; `POST /routes/:id/complete` com `{ mode }`
- Status `RouteStatus.INCOMPLETE`; tolerância **500 m** de restante planejado → ainda pode ser `COMPLETED`; pendentes → `SKIPPED`
- Gestor: resumo **Incompletas**; link **Ver trilha no mapa**; `GET /tracking/history?routeId=` + linha âmbar no `/map`
- Docs: hub §8, `API.md`, screens field-my-route/map, este changelog
- Como validar: arrastar com paradas longe → incompleta; ≤500 m ou tudo feito → concluída; abrir trilha no mapa

## v0.16.14 — 2026-09-10

### Cadastros — modo leitura + Editar

- Sintoma: detalhe de cliente/funcionário/veículo/usuário/empresa abria já com todos os inputs editáveis
- Correção: `EditableRecordShell` + `DetailItem`/`DetailSection` em `crud.tsx`; detalhe abre em view; botão Editar (lápis) libera o form; Cancelar descarta; Salvar volta à view
- Escopo: só detalhe/settings; `/new`, auth, rotas, mapa e campo inalterados
- Mapa do cliente/empresa em view: `CustomerLocationMap` `readOnly`
- Arquivos: `crud.tsx`, `CustomersPages.tsx`, `EmployeesPages.tsx`, `VehiclesPages.tsx`, `EditUserPage.tsx`, `CompanyAndUsers.tsx`, `CustomerLocationMap.tsx`
- Docs: `DOCUMENTACAO-SISTEMA.md` §8, screens customers/employees/vehicles/settings-*, este changelog
- Como validar: abrir qualquer `[id]` de cadastro → sem input até Editar; Cancelar; Salvar e conferir view

## v0.16.13 — 2026-09-10

### Multiempresa + tema claro/escuro + mapa stale

- **Empresas:** papel `PLATFORM_ADMIN`; `GET/POST /companies`, `GET/PATCH /companies/:id`; telas `/settings/companies*`; seed promove admin demo; RolesGuard faz PLATFORM_ADMIN herdar ADMIN
- **Tema:** toggle Claro/Escuro no menu da conta (`data-theme`, `localStorage` `samuel-theme`); padrão escuro; basemap Voyager no claro
- **Mapa:** `GET /tracking/live` com `presence: stale` se última atualização > 30 s; poll 3 s + suavização inalterados
- VPS: após migrate, promover operador se necessário (ver `docs/vps-atualizar.txt`)
- Docs: hub §2–§4/§8, `modules/companies.md`, `screens/settings-companies.md`

## v0.16.12 — 2026-09-10

### Gestão admin de rotas (antes do Play)

- ADMIN/MANAGER em **Rotas de hoje**: painel **Gerir** para cancelar, trocar funcionário/veículo/data e alterar paradas (ordem, incluir visitas livres, remover)
- API: `PATCH /api/v1/routes/:id`, `POST /api/v1/routes/:id/cancel` — só `PLANNED`|`PUBLISHED`; libera visitas; apaga stops no cancel
- SUPERVISOR: **Ver** (somente leitura)
- Fora de escopo: editar/cancelar `IN_PROGRESS`; criar OS no PATCH
- Docs: `docs/modules/routes.md`, `docs/screens/routes.md`, `docs/API.md`, hub §8

## v0.16.11 — 2026-09-10

### Marcos — marcar só com Gravar viagem; alerta em toda a rota

- Sintoma: botões Porteira/Ponte/Bifurcação/Estrada ruim apareciam em qualquer navegação; alerta e ícones olhavam só a próxima parada; no `/map` a rota pintada não mostrava marcos sem clicar no pin
- Correção: EMPLOYEE só cria marco se a rota `IN_PROGRESS` tem `recordTrip` (`LANDMARK_RECORD_TRIP_REQUIRED`); UI esconde botões sem Gravar viagem; proximidade/ícones usam marcos de **todas** as paradas; `/map` carrega marcos dos clientes ao pintar a rota
- Persistência: `CustomerLandmark` por cliente continua valendo em rotas/mapas futuros
- Arquivos: `access-path.util.ts`, `customers.service.ts`, `FieldNavigatePage.tsx`, `OperationalMap.tsx`, `access-path.spec.ts`
- Docs: `DOCUMENTACAO-SISTEMA.md` §8, `field-navigate.md`, `map.md`, `modules/routes.md`, `API.md`, este changelog
- Como validar: rota sem Gravar → sem botões, com banner se o cliente já tem marco; rota com Gravar → marcar Porteira → `/map` pin e rota pintada mostram ícone; rota futura do mesmo cliente alerta ≤120 m

## v0.16.10 — 2026-09-10

### EMPLOYEE sem catálogo Clientes

- Regra: funcionário de campo **não** acessa /customers (listar/criar/prontuário)
- API: GET/POST /customers, GET /customers/:id e ops customers/summary|list-enriched|:id sem EMPLOYEE (403); POST .../landmarks mantido (regras existentes)
- UI: nav Clientes só ADMIN/MANAGER/SUPERVISOR; capa campo sem botão Clientes; URL /customers* redireciona para Minha rota; nome do cliente em Minha rota sem link ao prontuário
- Como validar: login EMPLOYEE → sem Clientes na nav; /customers → Minha rota; gestor continua CRUD normal

## v0.16.9 — 2026-09-10

### UX — loading e anti-duplo-clique em mutações

- Sintoma: toque/clique repetido em Publicar, Iniciar rota, Salvar, Cancelar OS e formulários podia disparar POST/PATCH duplicado; feedback inconsistente entre telas
- Correção: primitives `useAsyncAction`, `ActionButton`, `LoadingOverlay`, `SubmitButton` em `components/ui`; `FormCard` desabilita campos enquanto salva; handlers com trava de reentrada; overlay em publicar rotas e iniciar rota (pending **antes** do GPS)
- Arquivos: `hooks/useAsyncAction.ts`, `components/ui/*`, `RoutesPlanner*.tsx`, `FieldStartRoutePage.tsx`, `FieldMyRoutePage.tsx`, `ServicesPages.tsx`, auth forms, `UserMenu.tsx`, `crud.tsx`
- Docs: PRD-UX §0.6, `routes.md`, `field-start-route.md`, `services.md`, este changelog
- Como validar: double-tap em Publicar / Iniciar / Salvar cliente / Cancelar OS / Login — uma chamada de rede; botão fica disabled até concluir; overlay em publicar e iniciar

## v0.16.6 — 2026-09-10

### Navegação — auto-centralizar no start + botão alvo mais alto

- Sintoma: ao iniciar a rota em `/field/navigate`, o mapa ficava em overview (carro + 1ª parada / geometria publicada) e não centralizava sozinho no GPS; botão Centralizar ficava baixo (`bottom-36`) e colidia com o HUD
- Causa: `followCamera` inicial fazia `fitBounds` + `setTimeout(450)` em vez de ir direto ao carro; alvo com offset fixo
- Correção: `jumpTo` imediato no carro no 1º GPS / `onLoad` se já houver fix; follow contínuo no ícone interpolado; botão ancorado acima do HUD (`-top-14` / `sm:-top-16`)
- Arquivos: `FieldNavigatePage.tsx`
- Docs: `field-navigate.md`, PRD-UX §5.3, este changelog
- Como validar: Play com GPS → mapa abre no carro (zoom ~16) sem tocar no alvo; arrastar → alvo escuro; tocar alvo → recentraliza; mobile/desktop botão acima dos marcos/HUD

## v0.16.5 — 2026-09-10

### Marcos no mapa — ícones no lugar de abreviações

- Sintoma: pins de porteira/bifurcação/etc. no `/map` e `/field/navigate` usavam texto (`Por`, `Bif`, …) e poluíam o mapa
- Correção: componente compartilhado `LandmarkMapMarker` com SVG por tipo; `title`/`aria-label` em português; botões e banner de proximidade inalterados
- Como validar: cliente com marcos em `/map` → ícones na trilha; navegação de campo → ícones na próxima parada; hover mostra Porteira/Bifurcação/…

## v0.16.4 — 2026-09-09

### Planejador — origem do cálculo (funcionário vs empresa)

- Sintoma: km/tempo no planejador por clientes caíam no pin da empresa assim que o GPS Redis (120 s) expirava; a lista sempre mostrava E mesmo quando o OSRM partia do funcionário
- Correção: seletor **Última localização** (padrão) | **Empresa**; Redis live → último `tracking_points` da empresa → fallback E com aviso; roundtrip continua no E; publish grava `origin*` = início do traçado
- Como validar: `/routes` modo Clientes → selecionar func + cliente → alternar origem e ver km/estimativa mudarem; sem GPS, aviso âmbar e cálculo pelo E; com GPS, pin F e lista começa no funcionário

## v0.16.3 — 2026-09-09

### Funcionário sempre com usuário de acesso

- Novo funcionário já criava User EMPLOYEE (e-mail + senha)
- Edição de quem ainda não tem login **não** pode mais salvar só o cadastro: e-mail + senha obrigatórios; API `EMPLOYEE_LOGIN_REQUIRED`
- Como validar: `/employees/new` → entrar no `/login` com esse e-mail; legado “Sem login” → salvar sem senha falha; com senha vira “Com login”

## v0.16.2 — 2026-09-09

### Deploy — VPS analise (PM2 + Docker, porta livre)

- Subida em `/opt/analise/SAMUEL`: PostGIS/Redis via `docker-compose.prod.yml`, web/API via PM2
- Portas loopback: web **3468** (Cloudflare), API 3469, PostGIS 5434, Redis 6381 — fora das rotas já ocupadas no túnel
- `LISTEN_HOST` na API; rewrite Next `API_PROXY_TARGET` precisa estar no **build**
- Túnel: `https://rotas.avadesk.com.br` → `http://localhost:3468` (conector `cloudflared` nesta VPS; pasta `/opt/analise/SAMUEL`)
- Mapa: mesma `NEXT_PUBLIC_CARTO_BASEMAPS_KEY` do `.env.local` local, gravada só na VPS e embutida no `next build` (sem watermark CARTO)
- Fix Usuários: middleware usa `x-forwarded-host` (não redireciona para `localhost:3468`); lista em `UsersListPage.tsx` sem puxar o mapa
- Como validar: `https://rotas.avadesk.com.br/settings/users` (ADMIN) e `curl -sI https://rotas.avadesk.com.br/settings/users` → Location em `rotas.avadesk.com.br`, não localhost

## v0.16.1 — 2026-09-07

### Fix — Mini-mapa em Minha rota + HUD ilegível no mapa

- Sintoma: card do funcionário em Minha rota não mostrava o traçado; no mapa, banner “Atenção — marco próximo” e o botão **OK** (e **Cheguei**) ficavam ilegíveis
- Causa raiz: após o remap Tailwind (`brand-900` = tinta clara `#f2f2f4`), o HUD ainda usava `bg-brand-900` + `text-amber-50` (botão claro + texto claro). Minha rota não tinha preview de geometria
- Correção: mini-mapa Dark Matter + polyline menta (`plannedGeometryJson` ou linha pelas paradas); banner de marco em superfície `#1C1C1E` com **OK** laranja; **Cheguei** preto `#121212` + branco; texto em âmbar usa `#121212` explícito
- Arquivos: `FieldRoutePreviewMap.tsx`, `FieldMyRoutePage.tsx`, `FieldNavigatePage.tsx`, `StartRoutePreviewMap.tsx`
- Como validar: EMPLOYEE → Minha rota vê o mini-mapa com linha menta; Navegar → banner de marco com **OK** laranja legível; pinos de marco no mapa = laranja + texto branco

## v0.16.0 — 2026-09-06

### Identidade operacional (visual)

- Sintoma: UI clara verde-musgo + serif lia como template, não como console de operação
- Causa: tokens e chrome únicos do mundo “gestor claro”; mapa Voyager; polyline verde/roxa
- Correção: fundo `#121212`, superfície `#1C1C1E`, acento `#FF5722`, Overpass; menta `#2EE6C7` só na polyline; basemap CARTO Dark Matter; hierarquia de botões/forms/nav sem mudar API nem fluxos
- Cadastros agrupados por intenção (Identificação / Contato / Endereço / Acesso); empty states com contexto; laranja só em interação
- Arquivos: `globals.css`, `tailwind.config.js`, `layout.tsx`, `crud.tsx`, chrome, mapa, telas de operação/cadastro/campo
- Como validar: login → Início → Mapa (linha menta) → Nova OS (seções) → celular 390px. Encerrar ≠ Concluir; KPI ausente continua `—`

## v0.15.4 — 2026-09-06

### Fix — HUD de viagem usava horas da trilha do admin

- Sintoma: ao iniciar navegação (Gravar viagem ou rota com trilha ACTIVE), Tempo/Restante/ETA vinham da gravação original ou ficavam em `—`; não acompanhavam o GPS nem a velocidade do funcionário
- Causa raiz: `tripFromAccessPath` colava a LineString inteira e a duração `dist/40 km/h`; o HUD usava steps/planned, não `coords.speed`
- Correção: recorte da trilha a partir da origem GPS; Tempo/ETA = km restantes ÷ velocidade ao vivo (última boa se parado; ~30 km/h sem histórico)
- Arquivos: `routes-geo.ts`, `nav-geometry.ts`, `FieldNavigatePage.tsx`
- Como validar: rota 1 cliente com trilha ACTIVE → Play → Navegar com GPS. HUD preenchido após o 1º fix; acelerar muda Tempo/ETA; parado não volta às horas da viagem original

## v0.15.3 — 2026-09-06

### Fix — Gravar viagem perdia a trilha em silêncio

- Sintoma: checkbox Gravar viagem marcado, check-in ok, mas o cliente ficava sem trilha ACTIVE
- Causa raiz: GPS descartado se um POST estava em voo; servidor gravava só 25 m/15 s; check-in engolia erro da consolidação; sem fila offline nem segunda chance no check-out
- Correção: fila local + lote/retry; persistência 5 m/2 s se `recordTrip`; `trailPoints` no Cheguei/Finalizar; LineString mínima origem+destino; `accessPath.saved` + audit; unique 1 ACTIVE por cliente
- Arquivos: `field-tracking.ts`, `field-track-queue.ts`, `tracking.service.ts`, `visits.service.ts`, `customers.service.ts`, `FieldNavigatePage.tsx`, `FieldVisitPage.tsx`, `OperationalMap.tsx`
- Como validar: publicar 1 cliente + Gravar viagem → navegar (badge com pts) → Cheguei → “Trilha gravada”; `/map` no cliente mostra linha roxa. Com rede ruim o badge fica âmbar e a trilha ainda vai no Cheguei.

## v0.15.2 — 2026-09-06

### Fix — Overlay vermelho ao abrir a navegação GPS

- Sintoma: `/field/navigate` quebrava com `TypeError: react_map_gl_maplibre.default is not a constructor` (overlay apontava `new Map()`)
- Causa raiz: o import `Map` de `react-map-gl/maplibre` sombreava o `Map` nativo; o cooldown de marcos fazia `new Map()` no componente React
- Arquivos: `apps/web/src/components/field/FieldNavigatePage.tsx`
- Como validar: EMPLOYEE com rota em andamento → `/field/navigate` abre o mapa, sem overlay vermelho

## v0.15.1 — 2026-09-05

### Fix — Client-side exception ao abrir localhost / 127.0.0.1

- Sintoma: tela branca com “Application error: a client-side exception has occurred while loading localhost”
- Causa raiz: Next.js 15 bloqueava assets `/_next/*` quando o host do browser (`127.0.0.1`) diferia do origin de dev (`localhost`); `allowedDevOrigins` só listava IPs da LAN
- Arquivos: `apps/web/next.config.js`
- Como validar: abrir `http://localhost:3000` e `http://127.0.0.1:3000` — login renderiza; sem warning “Blocked cross-origin request” no terminal do web

## v0.15.0 — 2026-09-04

### Feature — Gravar viagem + marcos de acesso à fazenda

- Cliente: CEP opcional; campos numéricos Lat/Lng sincronizados com o pin (`CustomersPages` + mapa)
- Planejador: checkbox **Gravar viagem** (`recordTrip`) — exige 1 cliente; densifica GPS (~2 s) na navegação
- No check-in de visita com `recordTrip`, consolida `TrackingPoint` → `CustomerAccessPath` (LineString ACTIVE; supersede anterior)
- Marcos `PORTEIRA|PONTE|BIFURCACAO|ESTRADA_RUIM` via `POST /customers/:id/landmarks`; alerta ≤120 m + OK (cooldown 5 min) em `/field/navigate`
- Rotas futuras com 1 parada e path ACTIVE usam a geometria gravada no lugar do OSRM; `GET /customers/:id/access` e mapa operacional desenham trilha/marcos
- Docs: plano 21, screens, modules/routes, API, DOCUMENTACAO-SISTEMA §8
- Testes: `access-path.spec.ts` + suite API 45 passed

## v0.14.1 — 2026-09-02

### Feature — Linha verde com recálculo ao vivo

- Sintoma: na navegação a linha teal mostrava U-turn / trecho atrás do carro; sair da rua demorava ~8–30 s para recalcular
- Correção: linha restante **verde** (`#86efac` / `#16a34a`) sempre nasce no GPS; 1º fix chama `POST /routes/:id/reroute` com reorder; off-route ~50 m / 2,5 s / cooldown 8 s; durante recálculo não pinta geometria velha
- Arquivos: `FieldNavigatePage.tsx`, `nav-geometry.ts`
- Docs: `field-navigate.md`, PRD-UX §5.3, PRD-DESIGN-HANDOFF, DOCUMENTACAO-SISTEMA
- Como validar: GPS na rua → linha verde encolhe no carro; virar outra rua → Recalculando em ~2–3 s e nova linha até a próxima parada

## v0.14.0 — 2026-09-02

### Feature — Centro de comando (home, mapa, planejador)

- Home do gestor: faixa EQUIPE / VISITAS / ROTAS / AO VIVO + execução + alertas + live + próximas visitas + rotas do dia; só métricas da API (`—` se ausente)
- Mapa: camadas Clientes / Equipe / Rotas / Todos; trilho direito com detalhe operacional (funcionário ou cliente); Presence ≠ Operational
- Planejador: RESUMO + `ROTA NN — Nome` + hierarquia E → 1 → 2 → E; Rotas de hoje com mesma hierarquia (paradas concluídas —)
- Label `IN_ROUTE` → “Em rota”
- Documentação: screens home/map/routes, PRD-UX, handoff (+ fase 2), DOCUMENTACAO-SISTEMA
- Arquivos: `OpsHomePage.tsx`, `OperationalMap.tsx`, `RoutesPlannerCustomers.tsx`, `RoutesTodayView.tsx`, `ops-types.ts`
- Fora desta entrega: prontuário OS/cliente, veículos, Minha rota/visita (fase 2 no handoff); `/field/navigate` inalterado

## v0.13.1 — 2026-09-02

### Fix — Timeout de GPS na navegação

- Sintoma: em `/field/navigate` o overlay “Localização necessária” com “GPS demorou demais” aparecia mesmo com Localização ligada; “Tentar GPS de novo” repetia o mesmo timeout
- Causa raiz: `watchPosition`/`getCurrentPosition` com `enableHighAccuracy: true`, timeout curto (15–20 s) e `maximumAge: 0`; TIMEOUT do watch (celular parado ou lock lento) marcava `gpsBlocked` permanente
- Correção: posição progressiva (GPS fino → rede/Wi‑Fi); watch sem timeout + seed coarse; TIMEOUT/UNAVAILABLE ignorados se já houver posição; botão de retry usa `requestCurrentPosition` progressivo
- Arquivos: `field-tracking.ts`, `FieldNavigatePage.tsx`
- Como validar: HTTPS/PWA com Localização ligada → pin em poucos segundos; parado ~20 s sem overlay; “Tentar GPS de novo” recupera posição coarse; HTTP `192.168…` e permissão negada mantêm mensagens atuais

## v0.13.0 — 2026-09-02

### Feature — Relatório de visita em campo (temas 12 + 13)

- Após check-in: formulário fixo em `/field/visits/[id]` — resultado (Realizada / Cliente ausente / Sem interesse / Precisa retorno), observações, fotos (1–5, até 5 MB), remarcar próxima visita
- `POST /api/v1/visits/:id/check-out` — GPS + outcome; visita `COMPLETED`/`FAILED`; `RouteStop` atualiza; opcional cria visita `ASSIGNED` na mesma OS (Agenda, não na rota de hoje)
- `POST|GET /api/v1/visits/:id/evidence` + `GET .../file` — fotos em disco (`STORAGE_DIR`), download autenticado
- Gestor vê relatório em `/services/[id]` (resultado, horários, notas, miniaturas)
- Navegação ignora paradas `COMPLETED`/`FAILED`/`SKIPPED` ao escolher próxima parada
- Testes: `visits-checkout.e2e-spec.ts`, `visit-checkout-state.spec.ts`
- Arquivos: `schema.prisma`, `visits.service.ts`, `visits.controller.ts`, `local-storage.service.ts`, `FieldVisitPage.tsx`, `FieldNavigatePage.tsx`, `ServicesPages.tsx`

## v0.12.1 — 2026-09-01

### Fix — Linha de navegação para na parada atual

- Sintoma: em `/field/navigate` a linha teal seguia depois do pin da parada-alvo (ex.: marcador 2) e desenhava o restante da rota (paradas 3, 4, …)
- Causa raiz: o mapa pintava `plannedGeometryJson` inteiro (LineString OSRM de todas as paradas), sem recortar no waypoint corrente
- Correção: o cliente recorta a geometria da posição (ou origem do trecho) até o fim do leg da próxima parada; pinos futuros continuam no mapa, sem traçado teal depois do destino atual. Recálculo OSRM e check-in não mudam
- Arquivos: `nav-geometry.ts`, `FieldNavigatePage.tsx`
- Como validar: rota com 3+ paradas → navegar → linha teal termina no pin da próxima; ao chegar (~40 m) e avançar o alvo, a linha passa a ir só até o novo pin

## v0.12.0 — 2026-09-01

### Feature — Check-in de visita (campo)

- EMPLOYEE registra **Cheguei** com GPS em `/field/visits/[id]` (entrada pelo banner Chegando em `/field/navigate`)
- API `POST /api/v1/visits/:id/check-in`; visita → `IN_PROGRESS`; `RouteStop` permanece `PENDING`
- Snapshot: `meta.inServiceAvailable = true`; `team.inService` e `operational = IN_SERVICE` quando há visita em atendimento
- Recheck-in 409; outro EMPLOYEE 403; outro tenant 404; ADMIN/MANAGER não fazem check-in
- Harness Jest + Supertest na API (`npm run test` em `apps/api`) com banco `samuel_test`
- Fora desta entrega: notas, foto, check-out
- Arquivos: `schema.prisma`, `visits.service.ts`, `ops.service.ts`, `FieldVisitPage.tsx`, `FieldNavigatePage.tsx`, testes em `apps/api/test/`
- Como validar: Play → navegar perto da parada → Cheguei → GPS → sucesso; home do gestor mostra Em atendimento ≥ 1

## v0.11.9 — 2026-09-01

### Fix — Mapa acompanha o carro na navegação

- Sintoma: em `/field/navigate` o ícone do carro se movia mas o mapa ficava parado (overview da rota ou só saltos esparsos); no celular um toque desligava o follow
- Causa raiz: câmera seguia GPS bruto com gate de 12 m, não o ícone interpolado; GPS antes do `onLoad` perdia centralização; `onTouchMove` desligava follow em qualquer gesto
- Correção:
  - Câmera sincronizada com `useSmoothedLngLat` (follow contínuo + look-ahead ~60 px)
  - Mapa pronto + GPS já existente centraliza no carro (não fica preso no `fitBounds` da rota)
  - Removido `onTouchMove`; só arrastar desliga follow; botão alvo recentraliza na hora
- Arquivos: `FieldNavigatePage.tsx`
- Como validar: Play → navigate com GPS → mapa acompanha o carro; arrastar pausa; alvo religa; toque curto não pausa

## Docs — 2026-09-01

- `PRD.md` **v1.6** alinhado ao software **v0.11.8**: execução PWA, GPS HTTP, mapa live e critérios de aceite 5–9 deixam de contradizer o código. Hub `DOCUMENTACAO-SISTEMA.md` aponta a versão.

## v0.11.8 — 2026-08-29

### Fix — Roster completo + faixa Equipe no mapa

- Sintoma: painel Operação mostrava Funcionários 2, Em rota 1, Offline 0 — o segundo sumia; sem pin não dava para abrir detalhes
- Causa raiz: `GET /ops/snapshot` só listava quem tinha GPS Redis ou rota PUBLISHED/IN_PROGRESS; COMPLETED/sem rota ficavam fora dos buckets e de `live[]`
- Correção:
  - API: classifica **todos** ACTIVE+login; `team.available`; `live[].routeStatus`; invariante `inRoute+parado+available+offline === total`
  - Mapa: faixa lateral Equipe (desktop); botão ☰ Equipe (mobile); clique abre drawer hambúrguer com presença / saiu da rota / paradas (mesmo sem pin)
  - Home: lista ao vivo com os mesmos nomes e status
- Arquivos: `ops.service.ts`, `ops-enriched.ts`, `ops-context.ts`, `OperationalMap.tsx`, `OpsHomePage.tsx`, `ops-types.ts`
- Como validar: 2 funcionários com login → KPIs somam 2; quem concluiu aparece Offline · Saiu da rota; clique na faixa abre drawer

## v0.11.7 — 2026-08-29

### Feature — Banner: rua da virada + faixa

- Sintoma: em `/field/navigate` o banner mostrava o trecho atual (“Saia em direção a QS 11”) sem a rua da próxima virada nem orientação de faixa
- Causa raiz: UI usava `currentStep` (pass-through `depart`/`continue`); API descartava `ref` e `intersections[].lanes` do OSRM
- Correção:
  - API: `compactOsrmSteps` persiste `ref` + `lanes` da 1ª intersection
  - PWA: `upcomingManeuver` escolhe a próxima virada; banner com rua (`name`||`ref`), ícones de faixa ou texto pelo `modifier`, distância até a manobra
- Arquivos: `routes-geo.ts`, `nav-geometry.ts`, `FieldNavigatePage.tsx`
- Como validar: navegar com GPS → banner “Vire … na {rua}” + faixa/distância (não só “Saia em direção a…”); após publish/reroute novo, ícones se OSRM mandar `lanes`

## v0.11.6 — 2026-08-29

### Fix — Watermark “API KEY REQUIRED” nos mapas CARTO

- Sintoma: tiles Voyager com carimbo “API KEY REQUIRED / carto.com/basemaps/apikey”
- Causa: CARTO passou a exigir `?key=` nas URLs raster; o app pedia tiles sem parâmetro
- Correção: `map-style.ts` monta Voyager com `NEXT_PUBLIC_CARTO_BASEMAPS_KEY`; valor só em `apps/web/.env.local` (não no git)
- Arquivos: `map-style.ts`, `apps/web/.env.example`, `.env.example`, docs de mapa/DEV/SECURITY
- Como validar: reiniciar Next → hard refresh em `/map` e `/field/navigate` → Network com `voyager/...png?key=` sem watermark

## v0.11.5 — 2026-08-29

### Feature — Rota ao vivo no mapa do admin

- Sintoma: gestor via o pin do carro, mas o GPS demorava e não havia como ver/pintar as ruas da rota no `/map`
- Correção:
  - Campo: envia GPS a cada **5 s** (heartbeat mesmo parado) via `field-tracking.ts`
  - Admin: poll `GET /tracking/live` a cada **3 s** + interpolação do pin 3 s
  - Clique no carro: lista paradas (`GET /routes/:id`) + botão **Ver no mapa** pinta LineString OSRM + pins numerados
  - Funcionário **Ver no mapa** → `/map?employeeId=` com auto-paint se ao vivo
- Arquivos: `field-tracking.ts`, `OperationalMap.tsx`, `LiveVehicleMarker.tsx`, `map/page.tsx`, `ops-context.ts`
- Como validar: EMPLOYEE Play → ADMIN `/map` → pin move → clique → Ver no mapa pinta ruas; `/employees/[id]` Ver no mapa foca o carro

## v0.11.4 — 2026-08-29

### Feature — Navegação a partir da localização atual (reroute)

- Sintoma: ao abrir `/field/navigate` longe da polyline, banner “Fora da rota — 130 km” e linha antiga; texto “recalculando” sem chamada de API
- Causa raiz: geometria congelada no Play; sem recálculo OSRM em runtime; no iPhone HTTP o GPS nem chega
- Correção:
  - API: `POST /routes/:id/reroute` recalcula geometry/steps a partir do GPS (pendentes mais perto → mais longe quando `reorderRemaining: true`)
  - PWA: 1º fix fora da rota chama reroute com reorder; off-route sustentado redesenha sem embaralhar ordem
- Arquivos: `routes.dto.ts`, `routes.controller.ts`, `routes.service.ts`, `FieldNavigatePage.tsx`
- Como validar: `localhost` com GPS → navegar → linha sai do carro até a parada 1 mais perto; banner com manobra

## v0.11.3 — 2026-08-29

### Fix — “Rota em andamento” sem rota para concluir

- Sintoma: ao iniciar uma rota nova, 422 `ROUTE_ALREADY_ACTIVE` e Minha rota não mostrava botão Concluir
- Causa raiz: `POST /routes/:id/start` bloqueia qualquer `IN_PROGRESS` do funcionário (qualquer data), mas `GET /field/my-route` listava só o dia de hoje — Encerrar no mapa não conclui; a rota de outro dia ficava invisível
- Correção: Minha rota inclui a `IN_PROGRESS` de outro dia (faixa âmbar + Concluir/Continuar); mensagem de start cita a data; wizard aponta para Minha rota
- Arquivos: `field.service.ts`, `routes.service.ts`, `FieldMyRoutePage.tsx`, `FieldStartRoutePage.tsx`
- Como validar: iniciar rota, Encerrar sem Concluir, no dia seguinte abrir Minha rota → card âmbar com **Concluir rota**; depois Play da rota de hoje funciona

## v0.11.2 — 2026-08-29

### Marca visível: Samuel → Rotas

- Sintoma: o produto ainda se chamava Samuel no login, header, sidebar, aba do navegador, PWA e textos de campo
- Correção: marca **Rotas** nesses pontos; pasta do repo, pacotes `@samuel/*` e empresa seed `Demo Samuel` permanecem
- Arquivos: `AuthCard.tsx`, `AppHeader.tsx`, `(app)/layout.tsx`, `layout.tsx`, `manifest.webmanifest`, `FieldPwaLocationGate.tsx`, `FieldNavigatePage.tsx`, `EmployeesPages.tsx`
- Como validar: `/login` mostra Rotas; após entrar, header e sidebar mostram Rotas; título da aba é Rotas

## v0.11.1 — 2026-08-29

### Fix — Iniciar rota no telefone em HTTP (LAN)

- Sintoma: no PC (`localhost`) o Play funcionava; no celular `http://IP` travava no passo de GPS
- Causa raiz: o browser trata `http://localhost` como contexto seguro e libera `geolocation`; `http://192.168…` não é seguro, o GPS nem pede permissão, e o wizard exigia `getCurrentPosition` para sair do passo 1
- Correção: em HTTP inseguro o wizard pula o GPS, usa a 1ª parada como origem do `POST /start` e mantém a ordem planejada. Faixa **NÃO ESTÁ EM HTTPS** continua. Pin ao vivo / “mais perto de você” só com GPS real
- Arquivo: `FieldStartRoutePage.tsx`
- Como validar: celular `http://IP` → Iniciar rota → Resumo (sem pedir Permitir) → km/combustível → ▶ Iniciar rota → navegar. PC localhost segue pedindo GPS

## v0.11.0 — 2026-08-29

### Feature — Pins pessoa/carro ao vivo + 1ª parada mais perto do funcionário

- Sintoma: pin genérico/seta/emoji 🚐; ao publicar, a ordem das paradas saía da empresa (não da posição do funcionário)
- Correção:
  - Wizard `/field/start`: mini-mapa com ícone de **pessoa** no Resumo; após escolher veículo vira **carro**; lista com km até cada parada
  - Navegação `/field/navigate`: carro interpolado seguindo o GPS
  - Mapa `/map`: SVG de carro (sem emoji) com interpolação entre polls de 4 s + heading
  - Publish/preview: paradas ordenadas **mais perto → mais longe** a partir da posição do funcionário (GPS Redis se online, senão pin da empresa); OSRM na ordem fixa; roundtrip volta ao **E**
  - Play continua recalculando com o GPS real do celular
- Arquivos: `LivePositionMarker.tsx`, `LiveVehicleMarker.tsx`, `useSmoothedLngLat.ts`, `StartRoutePreviewMap.tsx`, `FieldStartRoutePage.tsx`, `FieldNavigatePage.tsx`, `OperationalMap.tsx`, `field-tracking.ts`, `routes.service.ts`, `routes-geo.ts`
- Como validar: publicar 3+ clientes → parada 1 = mais perto do funcionário; Iniciar → pessoa no mapa + km; escolher carro → ícone carro; Play → navegar; gestor vê carro deslizando em `/map`

## v0.10.12 — 2026-08-29

### Fix — HTML `Cannot POST /api/v1/routes/preview-customers` no planejador

- Sintoma: ao selecionar clientes e funcionários em `/routes`, o erro vermelho era um HTML Express (`<!DOCTYPE html>…Cannot POST /api/v1/routes/preview-customers`)
- Causa raiz: o POST same-origin às vezes não atravessava o rewrite Next→Nest (`afterFiles`); o Express respondia 404 em HTML e o `apiFetch` jogava o HTML inteiro na tela. SUPERVISOR também não carregava funcionários (só ADMIN/MANAGER), então não conseguia o preview
- Arquivos: `next.config.js` (rewrite `beforeFiles`), `api-client.ts`, `http-exception.filter.ts`, `main.ts`, `RoutesPlannerCustomers.tsx`
- Como validar: `/routes` → Planejador → Clientes + funcionário com login → preview JSON (km/tempo), sem HTML; SUPERVISOR vê a lista de funcionários

## v0.10.11 — 2026-08-29

### Rotas — marcador E não é o cliente

- Sintoma: endereço de Unaí na parada, mas o **E** no mapa ficava em São Paulo
- Causa: **E** é o pin da Empresa (`Configurações → Empresa`), não o endereço do cliente; roundtrip desenha o traçado de volta à origem
- Correção: legenda no mapa, rótulo “Empresa” no pin verde, origem e “Volta à empresa” na lista; parada usa nome fantasia se existir
- Arquivos: `route-origin-ui.tsx`, `RoutesPlannerCustomers.tsx`, `RoutesPlannerVisits.tsx`, `routes.service.ts`
- Como validar: `/routes` → Planejador → um cliente fora da cidade da empresa → **E** com texto “Empresa” na origem; **1** no endereço do cliente; lista começa com origem

## v0.10.10 — 2026-08-29

### Planejador — marcador E = origem da empresa

- Mapa do planejador: **E** na origem da empresa; paradas numeradas 1, 2… nos clientes

## v0.10.9 — 2026-08-29

### Campo — HTTP não bloqueia mais a tela

- Sintoma: `http://192.168…` no celular parava em “Use o app em HTTPS”
- Causa: `FieldPwaLocationGate` tratava contexto inseguro como fase bloqueante (`insecure`)
- Correção: HTTP LAN entra nas telas de campo; faixa fixa **NÃO ESTÁ EM HTTPS** (`InsecureHttpBanner`). GPS do browser segue indisponível em HTTP (não é bypass)
- Arquivos: `FieldPwaLocationGate.tsx`, `InsecureHttpBanner.tsx`, layout `(field-nav)`, `FieldNavigatePage.tsx`
- Como validar: celular `http://IP:3000/field/my-route` → vê Minha rota + faixa âmbar; HTTPS + aba continua pedindo instalar o PWA

## Docs — 2026-08-29

- PRD UX/Funcional v0.9 — Tela por Tela: `docs/PRD-UX-FUNCIONAL.md` (componente, KPI, filtros, ações, empty/loading/erro, permissões, navegação de cada tela existente)
- Fichas alinhadas: `docs/screens/home.md`, `map.md`, `home-shell.md`, `field-pwa-gate.md`
- Software permanece **v0.10.8** (sem mudança de comportamento)

## v0.10.8 — 2026-08-28

### Feature — PWA obrigatório + pedido automático de GPS no campo

- Sintoma: funcionário usava o navegador em aba; GPS falhava ou era fácil recusar; banner de instalar dava para dispensar
- Causa: instalação era opcional; localização só no toque do wizard; sem service worker o Chrome mal oferecia “Instalar app”
- Correção: overlay `FieldPwaLocationGate` em `/field/*` (sem “agora não”); pede GPS ao abrir o PWA; wizard inicia o GPS sozinho; SW mínimo + ícones 192/512; HTTP LAN mostra que precisa HTTPS
- Limite: o iOS/Android **sempre** mostram o aviso nativo — o app não consegue ligar GPS no silêncio
- Arquivos: `FieldPwaLocationGate.tsx`, `pwa.ts`, `sw.js`, layouts field, `FieldStartRoutePage.tsx`, `docs/screens/field-pwa-gate.md`
- Como validar: celular HTTPS → aba bloqueada → instalar → ícone → Permitir no aviso do sistema → Minha rota; localhost no PC segue sem trava de instalação

## v0.10.7 — 2026-08-28

### Tracking — watchPosition + amostragem (modelo oficial)

- PWA: `startRouteGpsWatch` usa `navigator.geolocation.watchPosition` (não mais poll `getCurrentPosition`)
- Cliente só faz POST se andou ≥15 m ou passaram ≥10 s
- API: Redis atualiza sempre; PostGIS só se ≥25 m ou ≥15 s (`persisted` na resposta)
- Body opcional `speed` / `heading` no live Redis
- Docs: plano 11, ARCHITECTURE, API
- Arquivos: `field-tracking.ts`, `FieldNavigatePage.tsx`, `FieldMyRoutePage.tsx`, `tracking.service.ts`, `tracking.dto.ts`

## v0.10.6 — 2026-08-28

### Fix — Navegação presa em “Abrindo navegação SAMUEL…”

- Sintoma: `/field/navigate` ficava eternamente na tela de loading
- Causa: `loadOnceRef` + cleanup do React Strict Mode cancelava o 1º fetch e impedia o 2º → `loading` nunca virava `false`
- Correção: removeu loadOnce; timeout 20s + botão “Tentar de novo”
- Arquivo: `FieldNavigatePage.tsx`

## v0.10.5 — 2026-08-28

### Fix — Navegação piscando

- Sintoma: `/field/navigate` piscava a tela toda no celular
- Causa: efeito de load reexecutava com `setLoading(true)` (desmontava o mapa); `easeTo` + hint com relógio a cada poll de 3s; poll contínuo com GPS negado
- Correção: load uma vez; `jumpTo` só se moveu ≥12 m; hint no máx. 15s; para poll em permissão/HTTP
- Arquivo: `FieldNavigatePage.tsx`

## v0.10.4 — 2026-08-28

### Feature — Painéis operacionais (tema 20 — onda B + tudo)

- API: summaries (`/ops/*/summary`), context cards (`/ops/employees|vehicles|service-orders/:id`), listas enriquecidas, `/ops/agenda/summary`
- Web: `OperationalSummaryStrip` + `EntityContextPanel` em Clientes, Funcionários, Veículos, OS, Agenda
- Web: detalhes com resumo operacional, timeline real e links relacionados
- Web: `/routes` com aba **Rotas de hoje** + planejador
- Nav: **Recursos** / **Administração** (antes Cadastros / Gestão)
- Docs: PRD §13 UX v1.0, `docs/plans/20-paineis-operacionais.md`, `docs/modules/ops.md`

## v0.10.3 — 2026-08-28

### Fix — Navegação: mapa preto + 2000 km sem GPS (celular HTTP)

- Sintoma: `/field/navigate` no iPhone via `http://192.168…` ficava preto, HUD com ~2007 km / 24 h e erro “permission to use Geolocation”
- Causa: (1) Safari bloqueia GPS fora de HTTPS; (2) sem GPS o HUD usava `plannedDistanceMeters` inteiro; (3) tiles OSM.org falhavam e o fundo escuro parecia mapa morto; (4) mapa não enquadrava a rota sem posição
- Correção: tiles CARTO Voyager; `fitBounds` da rota no load; HUD `—` sem GPS; banner de permissão/HTTP; `geolocationErrorMessage`
- Arquivos: `FieldNavigatePage.tsx`, `map-style.ts`, `field-tracking.ts`, `docs/screens/field-navigate.md`, `docs/DEV.md`

## v0.10.2 — 2026-08-28

### Feature — Rota mais perto primeiro no Play

- Ao confirmar `POST /routes/:id/start`, paradas são reordenadas pelo GPS do funcionário (mais perto → mais longe)
- Recalcula `plannedGeometryJson`, `plannedStepsJson`, totais e PostGIS `planned_geometry` na ordem fixa (OSRM `/route` ou linha reta)
- Wizard `/field/start/[id]`: passo Resumo pré-visualiza a ordem por proximidade; navegação usa `sequence` 1 como primeira entrega
- Idempotência: rota já `IN_PROGRESS` não reordena de novo
- Arquivos: `routes-geo.ts`, `routes.service.ts`, `FieldStartRoutePage.tsx`, `FieldNavigatePage.tsx`, `FieldMyRoutePage.tsx`

## v0.10.1 — 2026-08-28

### Fix — Tracking HTTP + remoção Maps/Waze no campo

- Sintoma: card “GPS ativo (envio pendente)” com precisão ok, mas pin do gestor não atualizava; atalhos Maps/Waze na lista do funcionário
- Causa: `accuracy: null`/payload frágil no POST; erro da API engolido; deep-links externos nas paradas
- Correção: helper `postTrackingPoint` (só accuracy finita); DTO null-safe; status mostra mensagem real da API; removidos Google Maps/Waze de Minha rota
- Arquivos: `field-tracking.ts`, `FieldMyRoutePage.tsx`, `FieldNavigatePage.tsx`, `tracking.dto.ts`, `tracking.service.ts`
- Como validar: IN_PROGRESS → `GPS ativo · HH:MM:SS` + POST 200; `/map` com pin; paradas sem Maps/Waze

## v0.10.0 — 2026-08-28

### Tema 20 — IA operacional (Context Cards)

- API: módulo `ops` — `GET /ops/snapshot`, `GET /ops/customers/:id` + contrato TypeScript dos 7 objetos
- Web: sidebar agrupada Operação / Cadastros / Gestão (drawer no mobile)
- Web: `/` vira Centro de Operações (gestores); capa simples para EMPLOYEE
- Web: `/map` hub full-bleed — barra data/equipe, rodapé Operação|Detalhes, pin rico, clientes próximos (km)
- Rotas: `?customerId=` pré-seleciona cliente no modo Clientes
- Docs: plano 20, screens home/map, modules/ops, DOCUMENTACAO-SISTEMA, PRD

## Docs — 2026-08-28 (PRD UX/Funcional v0.9)

### Docs only — Tela por tela (sem bump de package)

- Expandiu todas as fichas em `docs/screens/*.md` no template UX v0.9 (componente, informação, KPI, filtros, ações, estados, permissões, navegação)
- Incluiu `field-start.md` (`/field/start/[id]`) alinhado ao código do tema 19
- `PRD.md` 1.4: capa software v0.9.1; §5 estado atual (campo/dispatch); §13 inventário + contexto entre telas
- Criou `DOCUMENTACAO-SISTEMA.md` (hub apontando PRD + screens + API)
- Sem mudança de comportamento de UI/API nesta entrada

## v0.9.2 — 2026-08-28

### Fix — Tracking GPS sem recarregar a página

- Sintoma: envio de posição a cada 3s parecia atualizar/recarregar a tela (às vezes ia para login)
- Causa: `apiFetch` com `authRedirect` padrão redirecionava em 401; reinício do poll a cada refresh da lista
- Correção: `POST /tracking/points` com `authRedirect: false`; UI só atualiza pin/HUD; poll GPS não reinicia se já ativo
- Arquivos: `FieldNavigatePage.tsx`, `FieldMyRoutePage.tsx`

## v0.9.1 — 2026-08-28

### Fix — Navegação: mapa sem tiles, km fantasmas e GPS em tempo real

- Sintoma: mapa com watermark “API KEY REQUIRED”; HUD com ~987 km / 12 h; GPS não atualizava de forma previsível
- Causa raiz: Carto Dark passou a exigir API key; restante usava a rota planejada inteira em vez da posição atual; `watchPosition` sem intervalo fixo
- Correção: tiles OpenStreetMap (sem token); `remainingFromCurrentPosition` (haversine até paradas quando fora da rota); poll GPS + `POST /tracking/points` a cada 3 s
- Arquivos: `map-style.ts`, `nav-geometry.ts`, `FieldNavigatePage.tsx`, `FieldMyRoutePage.tsx`
- Como validar: abrir navegação → mapa com ruas; HUD com km coerentes até o destino; texto “atualizado HH:MM:SS” a cada ~3 s; pin no `/map` do gestor

## v0.9.0 — 2026-08-28

### Tema 19 — PWA de campo + início de rota guiado

- PWA: `manifest.webmanifest` com `start_url: /field/my-route`; banner instalar em Minha rota (`FieldInstallBanner`)
- Web: wizard `/field/start/[id]` — GPS obrigatório, veículo, checklist (km/combustível/obs), confirmar com lat/lng
- API: `GET /field/vehicles?routeId=`; `POST /routes/:id/start` estendido com body de checklist e GPS inicial
- Prisma: `Route.startOdometerKm`, `startFuelLevel`, `startNotes`, `startLatitude`, `startLongitude`
- Navegação: centralização no primeiro fix GPS, botão Centralizar, confirmação ao sair, `wakeLock` best-effort
- Docs: plano 19, screens field-start-route/field-my-route/field-navigate, modules/tracking, API

## v0.8.1 — 2026-08-28

### Fix — Rota publicada não aparecia em Minha rota (fuso horário)

- Sintoma: gestor publicava rota para o funcionário, mas `/field/my-route` ficava vazio (especialmente após 21h BRT)
- Causa raiz: planejador gravava data local (`toDateInputValue`); API do campo filtrava por “hoje” em UTC (`getUTCDate`)
- Arquivos: `apps/api/src/common/date/business-day.ts`, `field.service.ts`, `routes.service.ts`, `FieldMyRoutePage.tsx`
- Correção: dia operacional unificado (`APP_TIMEZONE`, default `America/Sao_Paulo`); query `?date=` na API; poll 15s + refetch ao focar aba na PWA
- Como validar: publicar rota à noite → login do funcionário → rota aparece em até 15s sem F5

## v0.8.0 — 2026-08-25

### Tema 18 — Várias rotas no dia + tempo de deslocamento

- API: removido `ROUTE_EMPLOYEE_BUSY`; `preview/dispatch-customers` incluem `dayLoad` e reusam veículo do dia
- API: `POST /routes/:id/complete` (`IN_PROGRESS` → `COMPLETED` + `actualDurationSeconds`)
- API: `GET /field/my-route` devolve `{ routes, route }` (lista do dia)
- Web: planejador destaca deslocamento OSRM e soma do dia; Minha rota lista N rotas com Play/Continuar/Concluir
- Docs: plano 18, screens routes/field-my-route, modules/routes, API

## v0.7.1 — 2026-08-25

### Fix — Login no celular (LAN) via proxy `/api/v1`

- Sintoma: login EMPLOYEE no telefone (http://IP:3000) falhava / voltava ao login; no PC às vezes mascarava o problema
- Causa raiz: `middleware.ts` tratava `/api/v1/*` como rota protegida e redirecionava para `/login` antes do rewrite Next→Nest; o form recebia HTML em vez de JSON
- Arquivos: `apps/web/src/middleware.ts` (`/api` em `PUBLIC_PREFIXES`)
- Como validar: no celular, abrir Network URL; `GET /api/v1/health` deve retornar JSON; login com usuário ACTIVE

## v0.7.0 — 2026-08-25

### Tema 17 — Rota por clientes, login de campo e navegação GPS

- API: `POST /routes/preview-customers` e `POST /routes/dispatch-customers` (split + OSRM, OS/visitas no publish, veículos AVAILABLE)
- Prisma: `routes.planned_steps_json` (manobras OSRM no publish para a PWA)
- Employees: create exige `email`+`password` (User EMPLOYEE na mesma transação); edit com “Criar acesso”; sem User ID cru na UI
- Web: `/routes` modo **Clientes** (padrão) + Visitas; Play em `/field/my-route` redireciona para `/field/navigate` (MapLibre escuro, HUD, follow)
- Docs: plano 17, screens routes/employees/field-navigate/field-my-route, modules routes/employees, API, ARCHITECTURE

## v0.6.0 — 2026-08-24

### Temas 10–11 — Play da rota + pin do veículo (HTTP)

- Prisma: `routes.started_at`, tabela `tracking_points` (PostGIS Point + trigger)
- API: `GET /field/my-route`, `GET /field/tracking-status`, `POST /routes/:id/start`
- API: `POST /tracking/points` (Redis atual + histórico PostGIS), `GET /tracking/live` (poll)
- Web: `/field/my-route` (Play + GPS HTTP), `/field/tracking-status`
- Mapa: camada ao vivo com ícone/placa do veículo (poll 4s) — sem WebSocket
- Seed: `employee@demo.local` / mesma senha do admin, vinculado a Employee
- Docs: planos 10–11 done, screens field, módulo tracking

## v0.5.0 — 2026-08-24

### Temas 07–09 — OS → Visita → Rota (planejamento completo)

- Prisma: `service_orders`, `visits`, `routes`, `route_stops`, `companies.service_order_seq`
- API: CRUD OS/visitas/agenda; `POST /routes/preview` com `visitIds`; persistir + publicar rota; body JSON até 5mb (geometria OSRM)
- Web: `/services`, `/agenda`, mapa (Criar serviço / prontuário / próximas visitas), `RoutesPlanner` por visitas
- Publicar → rota `PUBLISHED`, visitas `ASSIGNED`; bloqueio `VISIT_CUSTOMER_NO_PIN`
- PRD 1.3; planos 07–16; docs API/screens/modules/ARCHITECTURE

## v0.4.1 — 2026-08-24

### Fix / DX — `npm run dev` estável

- Removido `concurrently -k` (um processo sair não mata o outro); até 3 reinícios
- `scripts/check-ports.mjs` no `predev` avisa se 3000/3001 estão ocupadas
- Docs: troubleshooting em `docs/DEV.md`

## v0.4.0 — 2026-08-24

### Tema 08 MVP — Rotas (origem + ordem de visitas)

- Prisma/migration: `companies.latitude/longitude/location/locationStatus` + trigger PostGIS
- API: `PATCH /companies/me` aceita pin; `POST /routes/preview` (OSRM trip, fallback nearest-neighbor+2-opt, rate limit Redis)
- Env: `OSRM_URL` (default público de dev)
- Web: Empresa com CEP/busca/pin; tela `/routes` (adiciona clientes, recalcula ordem, mapa com traçado); nav + home
- Docs: plano 08, módulo/screen routes, settings-company, API, CHANGELOG

## v0.3.2 — 2026-08-24

### Cliente inteligente — CNPJ, CEP e pin

- API: `GET /lookups/cnpj/:cnpj`, `GET /lookups/cep/:cep`, `GET /lookups/address?q=` (BrasilAPI + Nominatim, cache Redis)
- Web: formulário de cliente sem lat/lng digitáveis; clique/arraste no mini-mapa MapLibre; CEP/rua/CNPJ preenchem e puxam pin; salvar exige localização
- Docs: módulo lookups, screen customers, plano 06b

### Docs

- `PRD.md` 1.2: visão do produto + estado real (temas 00–06b entregues, 07–12 pendentes), critérios de aceite e inventário de telas/API.

## v0.3.1 — 2026-08-24

### Fix

- Loop `/` ↔ `/login` após wipe do banco: middleware só redireciona longe do login com `access_token`; em 401 o client chama logout (limpa cookies) antes de ir ao login.

## v0.3.0 — 2026-08-24

### Tema 06 — PostGIS + MapLibre

- Docker: imagem `postgis/postgis:16-3.5` (porta 5433)
- Migration: extensão PostGIS, `customers.location`, GIST, trigger lat/lng
- API: `GET /map/customers`, `GET /map/customers/nearby`, `POST /customers/:id/geocode` (Nominatim)
- Health: campo `postgis`
- Web: `/map` com MapLibre GL JS + OSM raster + painel lateral
- Docs: plano 06, módulo map, ARCHITECTURE/DEV atualizados

## v0.1.3 — 2026-08-24

### API — Companies / Users / Employees / Customers / Vehicles

- Migração Prisma `companies_employees_customers_vehicles` (campos Company + models Employee, Customer, Vehicle)
- Módulos Nest sob `apps/api/src/modules/{companies,users,employees,customers,vehicles}`
- Guards JwtAuthGuard + RolesGuard; escopo por `companyId` do JWT
- Web: nav + CRUDs settings / employees / customers / vehicles
- Docs: `docs/API.md`, `docs/modules/crm-ops.md`, screens, plans 02–05 done

## v0.1.2 — 2026-08-24

### Fix

- Next fixado em porta **3000** (`next dev -p 3000`).
- `apps/web/.env.local` sem `PORT` (cópia do `.env` da API fazia o Next subir em **3001** → `EADDRINUSE` na Nest).
- `apps/web/.env.example` só com `NEXT_PUBLIC_*`.

## v0.1.1 — 2026-08-24

### Fix / DX

- `npm run dev` / `npm run start`: sobe Docker, espera Postgres:5433 + Redis:6379, depois API + Web juntos (`concurrently`).
- `docker:up` usa `--wait` (healthcheck).
- Redis: handler de `error` para não spammar ECONNREFUSED no boot.
- Causa raiz do crash: API iniciava antes de Postgres/Redis estarem prontos (P1001 + ioredis ECONNREFUSED).

## v0.1.0 — 2026-08-23

### Fundação (Tema 00)

- Monorepo `apps/api` (NestJS + Prisma) + `apps/web` (Next.js App Router + Tailwind + PWA)
- Docker Compose: Postgres 16 + Redis 7 com healthchecks
- `GET /api/v1/health` (DB + Redis)
- Skill `.cursor/skills/samuel-docs/SKILL.md`
- `docs/ARCHITECTURE.md`

### Auth (Tema 01)

- Prisma: companies, users, refresh_tokens, password_reset_tokens, audit_logs
- Seed: Demo Samuel + `admin@demo.local`
- Endpoints: login, refresh, logout, me, forgot-password, reset-password, change-password
- Cookies httpOnly, bcrypt, rate limit Redis, audit, RBAC guards
- Telas: `/login`, `/forgot-password`, `/reset-password`, `/`, `/account/change-password`
- Docs de telas, módulos, segurança e planos 00–12
