## Tela: Visita em campo (check-in + relatório)

- Rota: `/field/visits/[id]`
- Papéis que acessam: EMPLOYEE (visita atribuída a ele). Outro EMPLOYEE: API 403. Outra empresa: 404.
- Objetivo: registrar chegada verificada (GPS), preencher relatório da visita (resultado, observações, fotos), finalizar e opcionalmente remarcar próxima visita na mesma OS.
- Layout (blocos):
  - Coluna `h-full`: miolo com `overflow-y-auto overscroll-y-contain` + faixa `shrink-0` de baixo (safe-area) com o botão principal
  - Cabeçalho: título “Visita”, link Voltar à navegação
  - Cliente (nome), OS, endereço, status
  - Fase 1: faixa de baixo com **Cheguei — chegada verificada** (GPS); as mensagens de erro/instrução ficam no miolo
  - Fase 2 (após check-in): banner “Chegada verificada”, **Acesso no caminho** (Porteira/Ponte/Bifurcação/Estrada ruim) **só se** a rota tem Gravar viagem, formulário de resultado, observações, fotos, remarcar próxima; **Finalizar visita** na faixa de baixo. Visita finalizada: **sem** faixa — fica só o bloco “Visita finalizada” no miolo
- Campos (nome, tipo, validação, erro):
  - GPS check-in: obrigatório no Cheguei
- **Resultado** (radio): `DONE` Realizada | `NO_CONTACT` Cliente ausente | `REFUSED` Sem interesse | `FOLLOW_UP` Precisa retorno
  - **Observações** (textarea, máx. 2000): obrigatório se resultado ≠ Realizada
  - **Fotos** (1–5): **Tirar foto** (câmera) / **Galeria**; JPEG comprimido no celular (lado ≤1600 px); coords do Cheguei (não espera GPS de novo); mínimo 1 se Realizada; HEIC vira erro de formato; >5 MB após compressão: “Foto excede 5 MB.”
  - **Remarcar próxima** (checkbox + datetime-local): obrigatório se Precisa retorno; data futura
  - GPS check-out: obrigatório em Finalizar
  - Se a rota tem Gravar viagem: envia `trailPoints` (fila local) no Cheguei e no Finalizar; aviso âmbar se < 2 pontos (segundo toque confirma); bloco **Acesso no caminho** (mesmos 4 marcos da navegação; GPS do toque, fallback lat/lng do check-in; fila `samuel:landmark-queue`)
- Ações / botões:
  - **Cheguei — chegada verificada** → `POST /api/v1/visits/:id/check-in` (+ `trailPoints` se gravar viagem)
  - **Tirar foto** / **Galeria** → `POST /api/v1/visits/:id/evidence` (multipart JPEG + lat/lng do Cheguei convertidos no servidor)
  - **Porteira / Ponte / Bifurcação / Estrada ruim** (só Gravar viagem, após check-in) → `POST /api/v1/customers/:id/landmarks`
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
  - `POST /api/v1/customers/:id/landmarks` (só Gravar viagem, após check-in)
  - `POST /api/v1/visits/:id/check-out`
- Redirects: após finalizar → `/field/navigate`. Entrada: banner Cheguei em `/field/navigate`.
- Mobile / PWA: layout `(field-nav)` tela cheia, ~375px, safe-area. Sem bottom nav nesta rota: o botão fica na faixa própria da tela, que não sai do lugar quando o miolo é puxado.
- Acessibilidade: labels em campos; erros `role="alert"`; sucesso `role="status"`.
- Fora de escopo: questionário configurável, PDF, vídeo, check-out pelo gestor.
- Como testar:
  1. EMPLOYEE → Navegar → Cheguei → GPS → check-in → formulário aparece.
  2. Realizada + foto + Finalizar → redirect navegação; próxima parada pendente.
  3. Precisa retorno + data futura → nova visita na Agenda (gestor em `/services/[id]`).
  4. Gestor vê relatório e fotos no detalhe da OS.
  5. Sem foto em Realizada → 422; outro EMPLOYEE → 403. Foto grande: comprime; se ainda >5 MB, mensagem clara (não 500).
  6. Rota Gravar viagem: badge na nav com pts; Cheguei com poucos pontos mostra aviso âmbar (segundo toque confirma); após check-in, faixa Trilha gravada (ou tentativa no Finalizar) e botões de marco **Acesso no caminho**.
  7. Rota sem Gravar viagem: visita sem o bloco de marcos.
  8. Celular: **Cheguei** (ou **Finalizar visita**) aparece na faixa de baixo sem rolar; puxar o endereço/formulário rola só o miolo e não move o botão.
