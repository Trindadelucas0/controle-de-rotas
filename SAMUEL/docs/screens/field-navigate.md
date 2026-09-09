# PRD UX/Funcional v0.9 — Navegação GPS (campo)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §5.3.

## Tela: Navegação GPS

### 1. Identidade

- Rota: `/field/navigate`
- Papéis: EMPLOYEE com rota `IN_PROGRESS`
- Objetivo: navegação tela cheia — mapa, manobra, HUD, GPS contínuo; **origem = posição GPS atual**; 1ª parada pendente = **mais perto** (recálculo no 1º fix / Play)
- Arquivos: `FieldNavigatePage.tsx`, layout `(field-nav)` sem AppHeader/AppNav

### 2. Componentes

```
div 100dvh (sem chrome do app)
├── Map Carto Dark
│   ├── LineString ativa menta (`#2EE6C7`) — só até a parada-alvo; nasce no carro; atualiza após reroute
│   ├── Markers paradas (próxima âmbar `#121212`; futuras laranja + branco)
│   ├── Markers de marcos (laranja + texto branco)
│   └── Marker GPS = ícone de **carro** (heading + interpolação suave)
├── faixa superior: instrução (superfície escura + tinta) / “Chegando…” (âmbar + `#121212`) / “Recalculando…” / “Fora da rota…” / badge Gravando · N pts (âmbar se fila de rede)
├── banner proximidade de marco (superfície `#1C1C1E` + **OK** laranja legível)
├── botões rápidos de marco (Porteira / Ponte / Bifurcação / Estrada ruim)
├── HUD inferior: tempo, km, ETA, km/h
└── controles: Encerrar (confirm); botão alvo / Centralizar (follow)
```

### 3. Informação

- Instrução da **próxima manobra real** (`plannedStepsJson`): pula `depart` / `continue` / `new name` / `notification` e mostra a virada à frente (rua = `name` || `ref`)
- Faixa: ícones OSRM (`lanes` da 1ª intersection) quando existirem; senão texto pelo `modifier` (`Faixa da esquerda` / `direita` / `Siga em frente` / `Faixa de retorno`). Rotatória/chegada: sem faixa inventada
- Distância até a virada (`em N m` / `em N km`)
- Seta principal (`aria-hidden`) alinhada ao modifier da próxima manobra
- Próxima parada / cliente (linha “Destino”)
- Velocidade, precisão GPS (hint)
- Confirmação ao sair: rota permanece IN_PROGRESS

Rotas publicadas antes de v0.11.7 já têm o `name` do próximo step (rua da virada funciona na hora). Ícones de faixa OSM só após novo publish/reroute; o texto de faixa pelo `modifier` vale no JSON antigo.

### 4. KPI / totais (HUD)

| KPI | Origem |
| --- | --- |
| Tempo restante | km restantes ÷ velocidade efetiva — **só com GPS**; sem GPS mostra `—` |
| Km restantes | polyline a partir do GPS (não o total da viagem gravada); sem GPS `—` |
| ETA | agora + tempo restante — `—` sem GPS |
| Velocidade km/h | `coords.speed` (ou deslocamento entre fixes); parado mostra `0` |

**Velocidade efetiva (Tempo/ETA):** GPS ao vivo se ≥ ~7 km/h; senão a última velocidade boa; parado sem histórico → ~30 km/h. Não usa as horas da trilha gravada pelo admin. Atualiza a cada fix.

Sem GPS: banner âmbar “Localização necessária” só para HTTP inseguro, permissão negada ou indisponível **após** fallback rede/Wi‑Fi. TIMEOUT transitório não trava a tela: hint “Procurando GPS…” enquanto o watch segue; seed coarse + GPS fino (ver `field-tracking.ts`).

“Chegando” (~80 m) e “Fora da rota” (~50 m à polyline; ignora fix com accuracy pior que 50 m) são UX — **não** prova de visita.

**Recálculo OSRM (ao vivo):**

| Gatilho | `reorderRemaining` | Efeito |
| --- | --- | --- |
| 1º fix GPS (sempre) | `true` | `POST /routes/:id/reroute` — origem = GPS; pendentes mais perto → mais longe; nova geometry/steps |
| Off-route sustentado (~2 samples e ≥2,5 s) + cooldown 8 s | `false` | Só redesenha traçado/manobras; **não** embaralha a ordem |

Banner “Recalculando…” enquanto a API responde; durante o recálculo / fora da rota **não** pinta a geometria velha (U-turn) — mostra conector GPS → próxima parada. Em erro, mantém o conector e mostra a mensagem.

Mapa: tiles CARTO Dark Matter (`dark_all`) com `?key=` via `NEXT_PUBLIC_CARTO_BASEMAPS_KEY` (não OSM.org). **Com GPS:** follow ligado por padrão — câmera acompanha o **ícone interpolado** do carro (zoom ~16, look-ahead para rua à frente); overview da rota inteira **não** compete com o follow. **Sem GPS:** `fitBounds` na rota ao carregar (evita tela preta). Sem a env, a CARTO desenha watermark “API KEY REQUIRED”.

Contraste do HUD: não usar `bg-brand-900` + `text-amber-50` (depois do remap, `brand-900` é tinta clara). Banner de marco = superfície + **OK** `ops-btn-primary`. Cheguei = `#121212` + branco. Texto sobre âmbar = `#121212`.

**Linha menta:** recorte no cliente até a parada corrente (`clipLineToNextStop` em `nav-geometry.ts`). Com GPS, o **primeiro ponto é sempre a posição do carro** (trecho já percorrido some); fim = fim do leg OSRM dessa parada (a linha termina no pin). Pinos das paradas seguintes permanecem. Trilha `CustomerAccessPath`: `start`/`reroute` recortam a geometria a partir do GPS (`tripFromAccessPath` / `clipAccessPathToOrigin`); o HUD de km/tempo segue a posição e a velocidade ao vivo.

### 5. Filtros e busca

N/A.

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Encerrar | confirma → `/field/my-route` (não cancela rota) |
| Cheguei (banner ~80 m) | abre `/field/visits/[id]` — **não** grava check-in sozinho |
| Centralizar (alvo) | reativa follow e recentraliza no ícone do carro na hora |
| Tentar GPS de novo | `requestCurrentPosition` progressivo (fino → coarse) + reinicia watch |
| Arrastar mapa (pan/drag) | desliga follow; toque simples **não** desliga |
| GPS watch | seed coarse + `watchPosition` → fila local → `POST /tracking/points` (lote até 50, retry) |
| Marcos | POST imediato; se falhar, fila `samuel:landmark-queue` + retry online/visibility |
| 1º GPS / off-route | `POST /routes/:id/reroute` |
| beforeunload / popstate | aviso sair |

### 7. Estados

| Estado | UI |
| --- | --- |
| loading | “Abrindo navegação Rotas…” |
| error / sem IN_PROGRESS | mensagem + “Voltar para Minha rota” |
| recalculating | banner sky “Recalculando a partir da sua posição…” |
| reroute error | banner vermelho com mensagem da API |
| success | nav ativa |
| empty | tratado como error |

### 8. Permissões

EMPLOYEE; exige Play/start prévio.

### 9. Navegação

Entrada: após `/field/start` ou “Continuar navegação”. Saída: Minha rota; **Cheguei** → `/field/visits/[id]`.

### 10. Mobile / PWA

`100dvh`, landscape ok; Wake Lock quando possível. HTTP LAN: faixa **NÃO ESTÁ EM HTTPS** no topo; GPS do browser segue bloqueado — **sem GPS não há recálculo**.

**Geolocation:** GPS só em HTTPS ou `localhost`. Em `http://192.168.x.x` a tela **abre** (não bloqueia). Para GPS no celular: túnel HTTPS, instalar o app, permitir localização no aviso do sistema. No PC com GPS, rotas iniciadas em HTTP (origem = 1ª parada) recalculam sozinhas no 1º fix.

### 11. Fora de escopo

Voz/TTS, trânsito ao vivo, Maps/Waze como UX principal. Check-in é na tela `/field/visits/[id]` (botão Cheguei no banner só navega).

### 12. Como testar

1. Start com GPS (`localhost`) → navigate **abre o mapa** (sem overlay vermelho) → centraliza no carro e **acompanha** o ícone ao se mover; banner “Recalculando…” no 1º fix → linha **menta** nasce no carro; banner com **próxima virada** (rua) + faixa/distância — não “Saia em direção a…” do trecho atual enquanto houver virada à frente.
2. Rota com **3+ paradas**: a linha menta vai até o pin da próxima (ex. 2) e **não** atravessa 3, 4…; os pinos seguintes continuam visíveis. Ao avançar, a linha encolhe a partir do carro. Ao passar ~40 m da parada, o alvo avança e a linha recorta de novo.
3. Arrastar o mapa → follow desliga (botão alvo escuro); toque sem arrastar mantém follow.
4. Tocar no alvo → volta a centralizar e acompanhar.
5. Rota já iniciada sem GPS real (HTTP) → abrir navigate no PC com GPS longe → banner Recalculando → nova linha menta (ainda só até a próxima parada).
6. Sair do corredor (~>50 m) por ~2–3 s → Recalculando (sem mudar ordem das paradas); U-turn velho não fica pintado.
7. Encerrar → lista ainda IN_PROGRESS.
8. Abrir navigate sem Play → erro.
9. Publish/reroute novo → se OSRM mandar `lanes`, ícones de faixa no banner; senão texto “Faixa da esquerda/direita…”.
10. Rota **Gravar viagem**: badge **Gravando · N pts**; com rede ruim fica âmbar (`N na fila`); marco com falha de rede reenvia sozinho.
11. Rota de 1 cliente com trilha ACTIVE (viagem passada): Play → Navegar com GPS. Tempo/Restante/ETA preenchidos após o 1º fix; linha menta nasce no carro (não no início da gravação). Acelerar/reduzir muda Tempo e ETA; Restante só cai com o deslocamento. Parado: VEL. 0; Tempo não volta às horas da viagem original.
12. Banner de marco: fundo escuro, título âmbar, **OK** laranja com texto branco — legível sobre o mapa.
