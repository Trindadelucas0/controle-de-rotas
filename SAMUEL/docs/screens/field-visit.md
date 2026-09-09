## Tela: Visita em campo (check-in + relatório)

- Rota: `/field/visits/[id]`
- Papéis que acessam: EMPLOYEE (visita atribuída a ele). Outro EMPLOYEE: API 403. Outra empresa: 404.
- Objetivo: registrar chegada verificada (GPS), preencher relatório da visita (resultado, observações, fotos), finalizar e opcionalmente remarcar próxima visita na mesma OS.
- Layout (blocos):
  - Cabeçalho: título “Visita”, link Voltar à navegação
  - Cliente (nome), OS, endereço, status
  - Fase 1: botão **Cheguei — chegada verificada** (GPS)
  - Fase 2 (após check-in): banner “Chegada verificada”, formulário de resultado, observações, fotos, remarcar próxima, **Finalizar visita**
- Campos (nome, tipo, validação, erro):
  - GPS check-in: obrigatório no Cheguei
- **Resultado** (radio): `DONE` Realizada | `NO_CONTACT` Cliente ausente | `REFUSED` Sem interesse | `FOLLOW_UP` Precisa retorno
  - **Observações** (textarea, máx. 2000): obrigatório se resultado ≠ Realizada
  - **Fotos** (file, 1–5, JPEG/PNG/WebP, 5 MB): mínimo 1 se Realizada; `capture="environment"`
  - **Remarcar próxima** (checkbox + datetime-local): obrigatório se Precisa retorno; data futura
  - GPS check-out: obrigatório em Finalizar
  - Se a rota tem Gravar viagem: envia `trailPoints` (fila local) no Cheguei e no Finalizar; aviso âmbar se < 2 pontos (segundo toque confirma)
- Ações / botões:
  - **Cheguei — chegada verificada** → `POST /api/v1/visits/:id/check-in` (+ `trailPoints` se gravar viagem)
  - **Adicionar foto** → `POST /api/v1/visits/:id/evidence` (multipart)
  - **Finalizar visita** → `POST /api/v1/visits/:id/check-out` → redirect `/field/navigate`
  - Voltar à navegação
- Estados: idle | loading | success | error | empty | forbidden
  - idle: visita carregada, sem check-in
  - loading: carregando / registrando / enviando foto / finalizando
  - success: check-in ok ou visita finalizada (redirect); faixa **Trilha gravada** ou **Trilha não gravada — será tentada ao finalizar**
  - error: GPS, validação, 409 já finalizada, 422 sem foto; âmbar se poucos pontos GPS
  - forbidden: 403
- Chamadas de API:
  - `GET /api/v1/visits/:id` (inclui `routeStop.route.recordTrip`)
  - `POST /api/v1/visits/:id/check-in`
  - `POST /api/v1/visits/:id/evidence`
  - `POST /api/v1/visits/:id/check-out`
- Redirects: após finalizar → `/field/navigate`. Entrada: banner Cheguei em `/field/navigate`.
- Mobile / PWA: layout `(field-nav)` tela cheia, ~375px, safe-area.
- Acessibilidade: labels em campos; erros `role="alert"`; sucesso `role="status"`.
- Fora de escopo: questionário configurável, PDF, vídeo, check-out pelo gestor.
- Como testar:
  1. EMPLOYEE → Navegar → Cheguei → GPS → check-in → formulário aparece.
  2. Realizada + foto + Finalizar → redirect navegação; próxima parada pendente.
  3. Precisa retorno + data futura → nova visita na Agenda (gestor em `/services/[id]`).
  4. Gestor vê relatório e fotos no detalhe da OS.
  5. Sem foto em Realizada → 422; outro EMPLOYEE → 403.
  6. Rota Gravar viagem: badge na nav com pts; Cheguei com poucos pontos mostra aviso âmbar (segundo toque confirma); após check-in, faixa Trilha gravada (ou tentativa no Finalizar).
