# PRD UX/Funcional v0.9 — Minha rota (campo)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §5.1.

## Tela: Minha rota

### 1. Identidade

- Rota: `/field/my-route`
- Papéis: EMPLOYEE (nav); API filtra rotas do funcionário
- Objetivo: capa do dia — lista rotas `PUBLISHED`/`IN_PROGRESS` do dia **e** qualquer `IN_PROGRESS` de outro dia (bloqueio); iniciar via wizard; concluir; GPS HTTP enquanto em andamento
- Arquivo: `FieldMyRoutePage.tsx`

### 2. Componentes

```
FieldPwaLocationGate (PWA+GPS em HTTPS; HTTP = faixa NÃO ESTÁ EM HTTPS)
└── section
    ├── header: título + KPI dia + Status GPS
    ├── erro role=alert
    ├── card Tracking HTTP (se IN_PROGRESS)
    └── articles por rota
        ├── status, veículo, km/tempo, paradas
        ├── ▶ Iniciar rota → /field/start/:id
        ├── Continuar navegação
        ├── SlideToComplete (arrastar) + modal CompleteRouteConfirm
        ├── mini-mapa (~160–176px) Dark Matter + polyline menta (`plannedGeometryJson` ou linha pelas paradas) + pinos numerados
        └── stops: cliente + OS (sem Maps/Waze)
```

### 3. Informação

Por rota: índice, status (Publicada / Em andamento), **data se não for hoje**, placa, duração/distância planejadas, N paradas.
Conclusão: arrastar → modal. `COMPLETED` se 0 pendentes ou restante ≤ 500 m; senão `INCOMPLETE`. Visita aberta bloqueia. Encerrar navegação **não** conclui.
Mini-mapa: traçado planejado (OSRM se `plannedGeometryJson` existir; senão LineString pelas coordenadas das paradas). Sem zoom por scroll. Pinos = sequência. Nome do cliente no card é tinta (não laranja).
Por parada: sequência publicada = mais perto do funcionário (GPS live ou empresa); após Play = ordem pelo GPS real. Navegação só pelo Rotas (`/field/navigate`).

### 4. KPI / totais

| KPI | Exemplo |
| --- | --- |
| Quantidade | `{N} rota(s) em dd/mm/aaaa` |
| Deslocamento do dia | `~{duração}` soma `plannedDurationSeconds` |
| Distância do dia | `{km}` soma `plannedDistanceMeters` |
| Por rota | duração · distância · N paradas |

### 5. Filtros e busca

Data implícita = hoje (`toDateInputValue`); a API também devolve `IN_PROGRESS` de outra data. Poll ~15s + visibilitychange. Sem date picker na UI.

### 6. Ações

| Ação | Condição | Efeito |
| --- | --- | --- |
| ▶ Iniciar rota | PUBLISHED e nenhuma IN_PROGRESS | `/field/start/:id` |
| Continuar navegação | IN_PROGRESS (do dia ou de outro dia) | `/field/navigate` |
| Concluir rota | IN_PROGRESS (do dia ou de outro dia) | `POST /field/routes/:id/complete` |
| Status GPS | sempre | `/field/tracking-status` |
| Ver agenda | empty state | `/agenda` |

GPS: a cada **3 s** → `getCurrentPosition` + `POST /tracking/points` (helper `postTrackingPoint`; sem Maps/Waze).
Status do card: sucesso → `GPS ativo · HH:MM:SS`; falha → **mensagem da API** (não “envio pendente” genérico). Sem recarregar a página.

### 7. Estados

| Estado | UI |
| --- | --- |
| loading | “Carregando suas rotas…” |
| empty | “Nenhuma rota para hoje (dd/mm/aaaa)…” + Ver agenda |
| published / in_progress | cards |
| aviso | “Conclua a rota em andamento…” nas rotas PUBLISHED |
| leftover | faixa âmbar “Rota de dd/mm ainda em andamento” + card com **Concluir rota** (IN_PROGRESS de outro dia) |
| error | alert vermelho |
| forbidden | N/A — API filtra |

### 8. Permissões

Só EMPLOYEE na nav. Outros papéis sem item.

### 9. Navegação

```
/routes (publicar) → /field/my-route → /field/start/:id → /field/navigate
                              ↘ /field/tracking-status
```

### 10. Mobile / PWA

Em HTTPS: app instalado (`standalone`) + GPS permitido. Overlay `FieldPwaLocationGate` (sem dispensar). Em HTTP LAN: entra com faixa **NÃO ESTÁ EM HTTPS**. Localhost no PC não trava instalação.

### 11. Fora de escopo

Check-in visita, fotos, WebSocket; cancelar rota ao Encerrar da nav; deep-links Google Maps/Waze (removidos — UX só Rotas).

### 12. Como testar

1. Gestor publica 2 rotas no dia.
2. EMPLOYEE → 2 cards **sem** botões Maps/Waze; cada card com mini-mapa e linha menta (ou linha reta entre paradas se ainda não houver geometria). Mini-mapa não captura o scroll da página (pan/zoom desligados).
3. Iniciar → wizard → navigate → Encerrar → Concluir → iniciar 2ª.
4. Com IN_PROGRESS: card Tracking → `GPS ativo · HH:MM:SS`; Network 200 em `POST /tracking/points`; pin no `/map` do gestor.
5. Deixar uma rota IN_PROGRESS de ontem sem concluir → Minha rota de hoje mostra o card âmbar com **Concluir rota**; Play das rotas de hoje fica bloqueado até concluir.
