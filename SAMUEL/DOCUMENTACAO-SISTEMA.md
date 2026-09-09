# Rotas — Documentação do Sistema

| Item | Valor |
|------|--------|
| Versão do sistema | 0.16.2 — Deploy VPS analise |
| Última atualização | 09/09/2026 — build + PM2 na VPS em 127.0.0.1:3468 |
| Fonte oficial de comportamento | Este hub aponta as fontes; **não** duplica regras inventadas |

## 1. Como usar este documento

| Camada | Arquivo | Conteúdo |
|--------|---------|----------|
| Produto | [`PRD.md`](PRD.md) | Visão, papéis, fases, critérios de aceite, inventário UX (**v1.7**, software v0.13.0) |
| UX tela a tela | [`docs/PRD-UX-FUNCIONAL.md`](docs/PRD-UX-FUNCIONAL.md) + [`docs/screens/`](docs/screens/) | PRD v0.9 consolidado + fichas por rota (botões, estados, navegação) |
| Design handoff (wireframes + cores) | [`docs/PRD-DESIGN-HANDOFF.md`](docs/PRD-DESIGN-HANDOFF.md) | Documento autocontido para colar em outra IA: layout ASCII, tokens hex, fluxos — **não** é fonte de comportamento |
| API | [`docs/API.md`](docs/API.md) + [`docs/modules/`](docs/modules/) | Contratos HTTP |
| Arquitetura / Dev / Segurança | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DEV.md`](docs/DEV.md), [`docs/SECURITY.md`](docs/SECURITY.md) | Stack, portas, env |
| Histórico | [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Versões |
| Planos | [`docs/plans/`](docs/plans/) | Temas de entrega |

Antes de editar código: ler a seção da tela em `docs/PRD-UX-FUNCIONAL.md` (ou a ficha em `docs/screens/`) + módulo em `docs/modules/` + trecho relevante do `PRD.md`.

## 2. Tecnologias utilizadas

Ver `PRD.md` §11 e `docs/ARCHITECTURE.md`. Resumo: Next.js 15 (web/PWA) → NestJS `/api/v1` → PostgreSQL+PostGIS + Redis; MapLibre + CARTO Dark Matter (`NEXT_PUBLIC_CARTO_BASEMAPS_KEY`); OSRM. UI: fundo `#121212`, superfície `#1C1C1E`, acento `#FF5722`, Overpass; menta `#2EE6C7` só em polyline de rota.

### 2.1 Histórico de versões

Ver `docs/CHANGELOG.md` (atual: **v0.16.2**).

## 3. Mapa de telas / conexões

Navegação (chrome): sidebar **Operação · Recursos · Administração** (`AppSidebarNav`).

```
Rotas
 ├── OPERAÇÃO — /, /map, /agenda, /services, /routes, /field/my-route (EMPLOYEE)
 │     campo tela cheia — /field/navigate, /field/visits/[id]
 ├── RECURSOS — /customers, /employees, /vehicles
 └── ADMINISTRAÇÃO — /settings/company, /settings/users
```

Cadeia de domínio:

```
Customer → ServiceOrder → Visit → RouteStop → Route → Employee + Vehicle
```

Read-model operacional: `GET /ops/snapshot` + summaries/context cards/list-enriched (tema 20).

## 4. Papéis e acesso

ADMIN · MANAGER · SUPERVISOR · EMPLOYEE — detalhes em `PRD.md` §7. Middleware só exige cookie; papel na nav/botões/API. `/ops/snapshot` só gestores; summaries de clientes/agenda também EMPLOYEE.

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

1. Subir: `npm run dev` (ver `docs/DEV.md` — seed `admin@demo.local` / `ChangeMe123!`).
2. **Gestor:** Início (Centro de Operações) — faixa EQUIPE / VISITAS / ROTAS / AO VIVO em ~3 segundos; execução + alertas; equipe ao vivo + próximas visitas + rotas do dia. Mapa: camadas Clientes/Equipe/Rotas/Todos + trilho direito (detalhe operacional). Rotas: RESUMO do planejador + ROTA NN — nome com E → 1 → 2 → E. No `/map`, ponto verde = online, cinza = offline; Status operacional ≠ Presença. Em Funcionários, **Ver no mapa** abre `/map?employeeId=` já focado. Ao abrir um cliente no mapa, o bloco **Acesso à fazenda** aparece sempre: trilha gravada (linha menta tracejada) ou **Sem trilha de acesso**, mais a contagem de marcos.
3. **Campo:** no celular, o ideal é HTTPS + app na tela inicial e **Permitir** no aviso de localização. Em `http://IP` a tela abre com **NÃO ESTÁ EM HTTPS**; o GPS do navegador continua bloqueado, mas dá para **Iniciar rota** (ordem planejada, origem = 1ª parada). Login EMPLOYEE → Minha rota (card com **mini-mapa** da linha planejada) → Iniciar → Resumo → veículo → checklist → Play → Navegar → perto da parada o banner **Chegando** ganha **Cheguei** → `/field/visits/[id]` → **Cheguei — chegada verificada** (GPS) → preencher **resultado**, **observações**, **fotos** (obrigatória se “Realizada”) → opcional **remarcar próxima** → **Finalizar visita** (GPS). Volta à navegação na próxima parada pendente. **Concluir rota** em Minha rota (Encerrar no mapa **não** conclui). Com GPS ativo o celular envia posição a cada **5 s** (mesmo parado); se a rota tiver **Gravar viagem**, a amostragem fica ~**2 s** e o badge mostra **Gravando · N pts** (âmbar se houver pontos na fila de rede). Os pontos ficam numa fila local se a internet falhar e vão no **Cheguei** (e de novo no **Finalizar** se a trilha ainda não salvou). Na navegação dá para marcar **Porteira / Ponte / Bifurcação / Estrada ruim** no GPS atual (se a rede falhar, o toque fica guardado e reenvia); perto de um marco (~120 m) aparece banner com **OK** (não repete o mesmo marco por ~5 min). **Concluir rota** em Minha rota. Se o GPS fino demorar, o app usa primeiro a posição de rede/Wi‑Fi e segue refinando — o overlay “GPS demorou demais” só aparece se as duas tentativas falharem (não por timeout curto sozinho). Se aparecer “rota em andamento”, o card com **Concluir** está no topo de Minha rota — inclusive se a rota for de outro dia. No PC, `http://localhost` libera GPS de verdade (o browser trata localhost como seguro): a navegação **sempre recalcula no 1º GPS** a partir da sua posição (1ª parada = mais perto) e, se você sair da rua planejada (~50 m por ~2–3 s), redesenha o traçado sem embaralhar as paradas. No mapa, a **linha menta nasce no carro e vai só até a próxima parada** (os pinos seguintes continuam visíveis, sem traçado depois do destino atual); Tempo / Restante / ETA no HUD seguem o GPS e a velocidade (não as horas da viagem gravada). O banner mostra a **próxima virada** (rua) e a **faixa** (ícones ou texto), não só “Saia em direção a…” do trecho atual. Sem GPS (HTTP no celular) o recálculo, check-in e finalizar **não** rodam. GPS com a tela bloqueada / app em segundo plano o navegador pode pausar — mantenha o app aberto na viagem.
4. **Gestor:** em `/services/[id]` cada visita finalizada mostra **Relatório de campo** (resultado, chegada/saída, observações, fotos). Nova visita remarcada aparece na **Agenda** no dia escolhido (não entra na rota de hoje).
4. Pin no mapa → Adicionar à rota → `/routes?customerId=` pré-seleciona o cliente. No planejador, **E** (verde) é a origem da empresa; **1, 2…** são as paradas **mais perto → mais longe** da posição do funcionário (GPS live se online, senão o E). Para mudar o **E**, vá em Configurações → Empresa. Em **Clientes**, CEP é opcional (fazendas): use Lat/Lng ou o pin. No planejador, marque **Gravar viagem** só com **1 cliente** — o check-in grava a trilha real (e o finalizar tenta de novo se o Cheguei falhou); na próxima rota de 1 cliente com trilha ACTIVE, o sistema usa essa geometria **recortada a partir do GPS do funcionário** (não as horas da viagem gravada); na navegação Tempo/Restante/ETA acompanham a posição e a velocidade ao vivo.

## 9. Checklist de validação

Percorrer “Como testar” de `docs/screens/home.md`, `map.md` e `docs/plans/20-ops-ia.md`.

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

No Cloudflare: Path `*`, Service `http://127.0.0.1:3468`. Depois do hostname HTTPS, gravar `CORS_ORIGIN=https://SEU-HOSTNAME` no `.env` da API e `pm2 restart analise-api`. Sem secrets neste documento.

## 12. Ao atualizar este documento

- Mudança de tela/fluxo → atualizar `docs/screens/{slug}.md` + `docs/PRD-UX-FUNCIONAL.md` + `PRD.md` §13 se inventário mudar.
- Mudança de API → `docs/API.md` / modules.
- Não criar segunda fonte oficial conflitante.
