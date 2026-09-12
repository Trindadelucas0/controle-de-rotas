# Rotas — Documentação do Sistema

| Item | Valor |
|------|--------|
| Versão do sistema | 0.18.0 — Gravar cliente (vários pontos) |
| Última atualização | 12/09/2026 — missão de gravar: marcar N clientes no GPS e finalizar quando quiser |
| Fonte oficial de comportamento | Este hub aponta as fontes; **não** duplica regras inventadas |

## 1. Como usar este documento

| Camada | Arquivo | Conteúdo |
|--------|---------|----------|
| Tutorial (entender) | [`docs/TUTORIAL.md`](docs/TUTORIAL.md) | Como a ferramenta funciona: papéis, menu, telas, conceitos — **não** substitui este hub |
| Guia de testes (clique a clique) | [`docs/GUIA-TESTES.md`](docs/GUIA-TESTES.md) | Roteiros ao vivo: clique → o que deve aparecer |
| Produto | [`PRD.md`](PRD.md) | Visão, papéis, fases, critérios de aceite, inventário UX (**v1.7**, software v0.13.0) |
| UX tela a tela | [`docs/PRD-UX-FUNCIONAL.md`](docs/PRD-UX-FUNCIONAL.md) + [`docs/screens/`](docs/screens/) | PRD v0.9 consolidado + fichas por rota (botões, estados, navegação) |
| Design handoff (wireframes + cores) | [`docs/PRD-DESIGN-HANDOFF.md`](docs/PRD-DESIGN-HANDOFF.md) | Documento autocontido para colar em outra IA: layout ASCII, tokens hex, fluxos — **não** é fonte de comportamento |
| API | [`docs/API.md`](docs/API.md) + [`docs/modules/`](docs/modules/) | Contratos HTTP |
| Arquitetura / Dev / Segurança | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DEV.md`](docs/DEV.md), [`docs/SECURITY.md`](docs/SECURITY.md) | Stack, portas, env |
| Histórico | [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Versões |
| Planos | [`docs/plans/`](docs/plans/) | Temas de entrega |

Antes de editar código: ler a seção da tela em `docs/PRD-UX-FUNCIONAL.md` (ou a ficha em `docs/screens/`) + módulo em `docs/modules/` + trecho relevante do `PRD.md`.

## 2. Tecnologias utilizadas

Ver `PRD.md` §11 e `docs/ARCHITECTURE.md`. Resumo: Next.js 15 (web/PWA) → NestJS `/api/v1` → PostgreSQL+PostGIS + Redis; MapLibre + CARTO Dark Matter / Voyager conforme tema (`NEXT_PUBLIC_CARTO_BASEMAPS_KEY`); OSRM. UI: tema **escuro** padrão (`#121212` / `#1C1C1E` / `#FF5722`) com toggle claro/escuro (`data-theme`, `localStorage` `samuel-theme`); header, sidebar e drawer do escritório usam `--surface` (não ficam pretos no claro); Overpass; menta `#2EE6C7` só em polyline de rota.

### 2.1 Histórico de versões

Ver `docs/CHANGELOG.md` (atual: **v0.18.0**).

## 3. Mapa de telas / conexões

Navegação (chrome): sidebar **Operação · Recursos · Administração** (`AppSidebarNav`).

```
Rotas
 ├── OPERAÇÃO — /, /map, /agenda, /services, /routes, /field/my-route (EMPLOYEE)
 │     campo tela cheia — /field/navigate, /field/visits/[id]
 ├── RECURSOS — /customers (não EMPLOYEE), /employees, /vehicles
 └── ADMINISTRAÇÃO — /settings/companies (PLATFORM_ADMIN), /settings/company, /settings/users
```

Cadeia de domínio:

```
Customer → ServiceOrder → Visit → RouteStop → Route → Employee + Vehicle
```

Read-model operacional: `GET /ops/snapshot` + summaries/context cards/list-enriched (tema 20).

## 4. Papéis e acesso

PLATFORM_ADMIN · ADMIN · MANAGER · SUPERVISOR · EMPLOYEE — detalhes em `PRD.md` §7. `PLATFORM_ADMIN` herda poderes de ADMIN no próprio tenant e, só ele, provisiona empresas (`/settings/companies`). Middleware só exige cookie; papel na nav/botões/API. `/ops/snapshot` só gestores; summary de agenda também EMPLOYEE. **Catálogo Clientes** (`/customers` + `GET/POST /customers` + ops customers) **sem** EMPLOYEE — campo vê nome/endereço só nas telas de rota/visita; landmarks em rota `IN_PROGRESS` mantidos.

## 5. Índice de rotas e “onde olhar no código”

| Rota | Código web | Doc UX |
|------|------------|--------|
| `/login` … auth | `apps/web/src/components/auth/*` | `docs/screens/login.md` etc. |
| `/` + chrome | `OpsHomePage.tsx`, `layout.tsx`, `AppNav.tsx` | `home.md` |
| Cadastros | `components/{customers,employees,vehicles,settings}/*` | screens correspondentes |
| `/map` | `OperationalMap.tsx` | `map.md` |
| `/services`, `/agenda`, `/routes` | `ServicesPages`, `AgendaPage`, `RoutesPlanner*` | screens |
| `/field/*` | `components/field/*` | `field-*.md` (incl. `field-visit.md`) |

API: `apps/api/src/modules/*` (incl. `ops`) — contratos em `docs/API.md`.

## 6. Telas e fluxos (fichas)

Todas as telas **existentes** estão em [`docs/PRD-UX-FUNCIONAL.md`](docs/PRD-UX-FUNCIONAL.md) (consolidado) e em `docs/screens/` (ficha por rota). Não inventar tela sem código. Para wireframes ASCII, cores hex e handoff a outra IA de design: [`docs/PRD-DESIGN-HANDOFF.md`](docs/PRD-DESIGN-HANDOFF.md).

## 7. Regras de negócio

Consolidadas no `PRD.md`. Ops: não inventar métrica; Presence (Redis) ≠ Operational derivado ≠ RH; “em atendimento” = visita `IN_PROGRESS` após check-in; após check-out a visita vai para `COMPLETED`/`FAILED` e a parada da rota atualiza.

## 8. Como usar o sistema (guia do dia a dia)

Passo a passo falado (clique aqui → deve aparecer isto): [`docs/TUTORIAL.md`](docs/TUTORIAL.md) e [`docs/GUIA-TESTES.md`](docs/GUIA-TESTES.md). O texto abaixo continua o resumo operacional.

1. Subir: `npm run dev` (ver `docs/DEV.md` — seed `admin@demo.local` / `ChangeMe123!` como **PLATFORM_ADMIN**). Em VPS já existente: após migrate, `UPDATE users SET role = 'PLATFORM_ADMIN' WHERE email = '…';` se o seed não rodar de novo.
2. **Gestor:** Início (Centro de Operações) — faixa EQUIPE / VISITAS / ROTAS / AO VIVO; execução + alertas; equipe ao vivo + próximas visitas + rotas do dia. **Tema:** no menu da conta, alterne **Claro/Escuro** (preferência no navegador). Mapa: camadas Clientes/Equipe/Rotas/Todos + trilho direito; ícones da equipe atualizam a cada **~3 s** (poll HTTP + deslize suave) — **online** se GPS ≤30 s, **stale** (mais apagado) se parou de atualizar; some após TTL Redis (~120 s). Rotas: RESUMO do planejador + ROTA NN — nome com F/E → 1 → 2 → E (F = última loc. do funcionário, se essa origem estiver selecionada). Em **Rotas de hoje**, use **Gerir** (ADMIN/MANAGER) em rotas ainda **Planejada** ou **Publicada** para cancelar, trocar funcionário/veículo/data ou alterar paradas (ordem, incluir visitas livres, remover); depois do Play (`Em andamento`) só dá para **Ver**. **ADMIN** (e PLATFORM_ADMIN) pode **Excluir rota** em qualquer status **exceto** Em andamento (some da lista; visitas ainda atribuídas voltam livres). Status operacional ≠ Presença. Em Funcionários, **Novo** pede e-mail + senha e cria o usuário de campo na hora (não há funcionário sem acesso). **Ver no mapa** abre `/map?employeeId=` já focado. Ao abrir um cliente no mapa, o bloco **Acesso à fazenda** aparece sempre: trilha gravada (linha menta tracejada) ou **Sem trilha de acesso**, mais a contagem de marcos; no mapa os marcos aparecem como **ícones** (porteira, ponte, bifurcação, estrada ruim), sem abreviação de texto; **toque no ícone** abre o nome do marco e **quem adicionou**. Ao **pintar a rota** de um veículo, os marcos dos clientes dessa rota também aparecem no mapa (sem precisar clicar em cada pin). Em **cadastros** (Cliente, Funcionário, Veículo, Usuário, Empresa), o detalhe abre em **leitura organizada**; clique em **Editar** (lápis) para liberar os campos; **Cancelar** descarta; **Salvar** grava e volta à leitura. Telas **Novo**, login, rotas, mapa e campo continuam com inputs abertos.
2b. **Plataforma (`PLATFORM_ADMIN`):** Administração → **Empresas** → Nova empresa (dados + admin inicial). O admin criado entra com o e-mail dele e só vê o tenant novo. O item **Empresa** edita a empresa do login atual (pin E, etc.).
3. **Campo:** no celular, a **página não dá zoom** (pinch, duplo toque ou teclado); só o **mapa** (Navegar, Mapa operacional, planejador, pin do cliente) amplia com pinça. O mini-mapa de Minha rota não dá zoom. O ideal é HTTPS + app na tela inicial e **Permitir** no aviso de localização. Em `http://IP` a tela abre com **NÃO ESTÁ EM HTTPS**; o GPS do navegador continua bloqueado, mas dá para **Iniciar rota** (ordem planejada, origem = 1ª parada). Login EMPLOYEE → capa com **Minha rota** e **Agenda** (sem Clientes) → Minha rota (card com **mini-mapa** da linha planejada; nome do cliente na parada **sem** link ao prontuário) → Iniciar → Resumo → veículo (último km/combustível; **não** dá para pegar um carro que já está em rota) → checklist (km, combustível, **foto do odômetro**) → Play → Navegar → perto da parada o banner **Chegando** ganha **Cheguei** → `/field/visits/[id]` → **Cheguei — chegada verificada** (GPS) → preencher **resultado**, **observações**, **fotos** (obrigatória se “Realizada”) → opcional **remarcar próxima** → **Finalizar visita** (GPS). Volta à navegação na próxima parada pendente. **Concluir rota:** arraste o controle em **Minha rota** ou na **navegação** (Encerrar no mapa **não** conclui). Informe **km final**, combustível e **outra foto do odômetro** (sem texto de “fraude” no celular). O sistema pergunta a condição: se todas as paradas foram feitas **ou** a distância restante planejada for ≤ **500 m**, confirma e grava `COMPLETED`; se restar mais de 500 m, confirma **incompleta** (`INCOMPLETE`, paradas pendentes `SKIPPED`) e o gestor vê no painel + trilha GPS no mapa. Visita aberta bloqueia a conclusão. Com GPS ativo o celular envia posição a cada **5 s** (mesmo parado); se a rota tiver **Gravar viagem**, a amostragem fica ~**2 s** e o badge mostra **Gravando · N pts** (âmbar se houver pontos na fila de rede). Os pontos ficam numa fila local se a internet falhar e vão no **Cheguei** (e de novo no **Finalizar** se a trilha ainda não salvou). **Só com Gravar viagem** a navegação mostra botões **Porteira / Ponte / Bifurcação / Estrada ruim** (GPS atual; se a rede falhar, o toque fica guardado e reenvia). Sem Gravar viagem a navegação segue normal, sem esses botões. Marcos já gravados no cliente ficam salvos e aparecem em **qualquer** rota/mapa futura desse cliente como **ícones** (não “Por”/“Bif”); **toque no ícone** mostra o nome (Porteira, Ponte…) e quem marcou. Perto de um marco de **qualquer parada da rota** (~120 m), se a rota tiver **Gravar viagem**, o banner pergunta **Ainda existe porteira?** (ou o tipo): **Sim, permanece** ou **Não, retirar** (some do cliente; se a rede falhar, a retirada fica na fila). Sem Gravar viagem o banner continua só com **OK**. Não pergunta de novo o mesmo marco por ~5 min (nem logo após marcar). Se o GPS fino demorar, o app usa primeiro a posição de rede/Wi‑Fi e segue refinando — o overlay “GPS demorou demais” só aparece se as duas tentativas falharem (não por timeout curto sozinho). Se aparecer “rota em andamento”, o card com o arrastar para concluir está no topo de Minha rota — inclusive se a rota for de outro dia. No PC, `http://localhost` libera GPS de verdade (o browser trata localhost como seguro): a navegação **sempre recalcula no 1º GPS** a partir da sua posição (1ª parada = mais perto) e, se você sair da rua planejada (~50 m por ~2–3 s), redesenha o traçado sem embaralhar as paradas. No mapa, a **linha menta nasce no carro e vai só até a próxima parada** (os pinos seguintes continuam visíveis, sem traçado depois do destino atual); Tempo / Restante / ETA no HUD seguem o GPS e a velocidade (não as horas da viagem gravada). O banner mostra a **próxima virada** (rua) e a **faixa** (ícones ou texto), não só “Saia em direção a…” do trecho atual. Sem GPS (HTTP no celular) o recálculo, check-in e finalizar **não** rodam. GPS com a tela bloqueada / app em segundo plano o navegador pode pausar — mantenha o app aberto na viagem.
4. **Gestor:** em `/services/[id]` cada visita finalizada mostra **Relatório de campo** (resultado, chegada/saída, observações, fotos). Nova visita remarcada aparece na **Agenda** no dia escolhido (não entra na rota de hoje). Em **Rotas de hoje**, rotas **Incompletas** aparecem no resumo; **Ver trilha no mapa** abre `/map?routeId=` com a linha planejada (menta) e a **trilha GPS real congelada** (âmbar) do caminho do funcionário. Rota **Em andamento** travada: ADMIN/MANAGER da mesma empresa pode **concluir** (a API aceita sem foto; o arrastar do campo pede km + foto). No **Início**, alertas de km alto e “saiu da rota”; no perfil do funcionário, **Observações de auditoria** com fotos, números e rota (o funcionário **não** vê isso).
5. Pin no mapa → Adicionar à rota → `/routes?customerId=` pré-seleciona o cliente. No planejador **Por clientes**, escolha **Origem do cálculo**: **Última localização** (padrão — GPS ao vivo ou último ponto gravado do funcionário) ou **Empresa** (pin E). Km, estimativa e ordem das paradas saem dessa origem; **Voltar para a empresa no fim** continua no E. Sem GPS, o cálculo usa o E e avisa. Para mudar o pin E, vá em Configurações → Empresa. Em **Clientes**, CEP é opcional (fazendas): use Lat/Lng ou o pin. No planejador, marque **Gravar viagem** para densificar o GPS e gravar a trilha real até **cada** cliente no Cheguei (vale para **todas** as rotas do lote); o finalizar tenta de novo se o Cheguei falhou. Na próxima rota de **1 cliente** com trilha ACTIVE, o sistema usa essa geometria **recortada a partir do GPS do funcionário** (não as horas da viagem gravada); na navegação Tempo/Restante/ETA acompanham a posição e a velocidade ao vivo. Aba **Gravar cliente**: gestor escolhe funcionário, data e veículo e **Publicar missão de gravar** — sem lista de clientes. No campo: **Adicionar ponto** (nome obrigatório no GPS atual; GPS não para) e **Finalizar por completo** quando quiser (0 ou N pontos; não pede nome). Cadastro só com nome fica **Em aberto** (lápis no `/map`); funcionário dono e gestor completam depois. Placeholder interno da sessão não aparece no mapa nem na lista de clientes.

## 9. Checklist de validação

Ensaio ao vivo (gestor + campo): [`docs/GUIA-TESTES.md`](docs/GUIA-TESTES.md). Detalhe técnico por tela: “Como testar” em `docs/screens/home.md`, `map.md` e `docs/plans/20-ops-ia.md`.

## 10. Segurança

Só o implementado: `docs/SECURITY.md`. Secrets em `.env`; sem `NEXT_PUBLIC_` de secret.

## 11. Deploy / ambiente

### Dev local

`docs/DEV.md`. Portas: Web 3000, API 3001, PostGIS 5433, Redis 6379.

### Produção VPS (analise)

Pasta: `/opt/analise/SAMUEL`. Docker `docker-compose.prod.yml` + PM2 `ecosystem.config.cjs`. Bind só em loopback.

| Serviço | Porta |
| --- | --- |
| Web (Next) — Cloudflare aponta aqui | **127.0.0.1:3468** |
| API (Nest) | 127.0.0.1:3469 |
| PostGIS | 127.0.0.1:5434 |
| Redis | 127.0.0.1:6381 |

Público: `https://rotas.avadesk.com.br` (Cloudflare Tunnel → HTTP `localhost:3468`). Código na VPS: `/opt/analise/SAMUEL` (não está em `/root`). Path vazio; Type HTTP. `CORS_ORIGIN` no `.env` do servidor = `https://rotas.avadesk.com.br`. `NEXT_PUBLIC_CARTO_BASEMAPS_KEY` em `apps/web/.env.local` no servidor e **rebuild** do Next (a chave entra no JS). Middleware usa `x-forwarded-host` (`rotas.avadesk.com.br`) para não redirecionar para `localhost:3468`. Atualização: [`docs/vps-atualizar.txt`](docs/vps-atualizar.txt) (backup `.env` + `reset --hard origin/main` + Docker + Prisma + build + PM2). Sem secrets neste documento.

## 12. Ao atualizar este documento

- Mudança de tela/fluxo → atualizar `docs/screens/{slug}.md` + `docs/PRD-UX-FUNCIONAL.md` + `PRD.md` §13 se inventário mudar. Se o clique do usuário mudar, alinhar [`docs/TUTORIAL.md`](docs/TUTORIAL.md) e [`docs/GUIA-TESTES.md`](docs/GUIA-TESTES.md) (camada pedagógica; **não** inventar regra só lá).
- Mudança de API → `docs/API.md` / modules.
- Não criar segunda fonte oficial conflitante.
