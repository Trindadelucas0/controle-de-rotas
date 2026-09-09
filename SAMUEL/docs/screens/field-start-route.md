# PRD UX/Funcional v0.9 — Iniciar rota (ficha curta)

Canônica completa: [field-start.md](field-start.md) e [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §5.2.

## Tela: Iniciar rota (wizard campo)

- Rota: `/field/start/[id]`
- Papéis: EMPLOYEE (rota `PUBLISHED` atribuída a si)
- Objetivo: gate de permissões + checklist antes de abrir navegação; substitui Play direto em Minha rota
- Layout (blocos):
  - Cabeçalho: link voltar, título, resumo km/tempo/paradas
  - Stepper (5 passos numerados)
  - Card do passo atual
- Campos:
  - **GPS** — pedido automático ao abrir o passo; botão se o sistema exigir toque; erro se negado (obrigatório)
  - **Resumo** — mini-mapa Dark Matter com polyline menta + pin **pessoa**; paradas da mais perto para a mais longe + km (preview local; ordem definitiva no Play)
  - **Veículo** — pin vira **carro**; select (`GET /field/vehicles`); pré-seleciona veículo da rota se houver
  - **Km inicial** — number, obrigatório, > 0
  - **Combustível** — select: Vazio, 1/4, 1/2, 3/4, Cheio
  - **Observação** — textarea opcional, máx. 500 caracteres
  - Checklist/Confirmar mantêm o mini-mapa com pin carro
- Ações / botões:
  - Permitir localização → passo Resumo (solicita câmera/microfone em best-effort, não bloqueia)
  - Continuar / Voltar entre passos
  - **▶ Iniciar rota** (confirmar) → `POST /routes/:id/start` com body completo → `/field/navigate`
- Estados: loading | error (rota não encontrada) | already_active (link Minha rota) | wizard steps | submitting
- Chamadas de API:
  - `GET /field/my-route?date=` — valida rota `PUBLISHED`
  - `GET /field/vehicles?routeId=`
  - `POST /routes/:id/start` — `{ vehicleId, startOdometerKm, startFuelLevel, startNotes?, latitude, longitude }`
- Redirects: sucesso → `/field/navigate`; `ROUTE_ALREADY_ACTIVE` → link Minha rota para concluir; erro fatal → link Minha rota
- Mobile / PWA: HTTPS pede GPS; HTTP LAN abre com faixa **NÃO ESTÁ EM HTTPS** e inicia sem GPS (1ª parada)
- Acessibilidade: erros com `role="alert"`; labels nos campos
- Fora de escopo: foto obrigatória, edição de paradas, cancelamento da rota
- Como testar:
  1. Publicar rota para funcionário → Minha rota → **Iniciar rota**
  2. Negar GPS → botão bloqueado / mensagem; permitir → avança
  3. No passo Resumo, conferir ordem por proximidade (1 = mais perto)
  4. Escolher veículo, preencher km e combustível → confirmar
  5. Ver redirect para navegação com mapa centralizado na 1ª parada (mais perto)
  6. Tentar abrir wizard de rota já `IN_PROGRESS` → redireciona para `/field/navigate`
  7. Com outra rota `IN_PROGRESS` (mesmo de outro dia) → alerta + “Ir para Minha rota e concluir”
