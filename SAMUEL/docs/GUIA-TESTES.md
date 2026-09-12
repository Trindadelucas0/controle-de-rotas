# Guia de testes — clique a clique

Siga em voz alta ou com o sistema aberto. Marque `[x]` no que passou.

Antes: leia o [Tutorial](TUTORIAL.md) se não souber o que cada tela é. Regras oficiais: [`DOCUMENTACAO-SISTEMA.md`](../DOCUMENTACAO-SISTEMA.md).

**Como usar este guia**

- Cada roteiro: objetivo, quem (papel), passos, o que deve aparecer, se falhar.
- Ordem = um dia completo. Se cliente, funcionário e veículo já existem, pule 4–7 e vá ao 9.
- Sem GPS no celular (faixa **NÃO ESTÁ EM HTTPS**): dá para publicar e iniciar; **não** dá para **Cheguei** / **Finalizar visita**. Use um aparelho com localização permitida, ou o computador em contexto seguro.
- Login: o seu usuário. Se for a **demo local**, gestor `admin@demo.local` e campo `employee@demo.local` (mesma senha do seed). Não use senha de produção neste arquivo.

No celular, o menu fica atrás do **☰**. No computador, à esquerda.

---

## Roteiro 1 — Entrar (gestor)

**Objetivo:** abrir o Centro de Operações.  
**Quem:** PLATFORM_ADMIN, ADMIN, MANAGER ou SUPERVISOR.

- [ ] Na tela **Entrar**, clique no campo **E-mail** e digite o e-mail.
- [ ] Clique em **Senha** e digite a senha (mínimo 8 caracteres).
- [ ] Clique no botão **Entrar** (enquanto envia, o botão fica ocupado).

**O que deve aparecer:** menu com **Operação** (Início, e conforme o papel Mapa, Agenda, Serviços, Rotas). Título **Centro de Operações**. No canto, seu nome e o papel.

**Se falhar**

- “Informe um e-mail válido.” / “A senha deve ter pelo menos 8 caracteres.” → corrija o campo.
- “E-mail ou senha inválidos.” → conferir usuário (não diz qual lado errou).
- Conta inativa/suspensa → mensagem 403.
- “Muitas tentativas…” → espere e tente de novo.

---

## Roteiro 2 — Entrar (campo) e conferir o menu

**Objetivo:** ver que o funcionário **não** tem catálogo de clientes.  
**Quem:** EMPLOYEE. Faça **Sair** do gestor antes, ou use outro navegador / aba anônima.

- [ ] **Entrar** com o login de campo.
- [ ] Olhe o Início: texto **Olá, {nome}**, empresa · Campo, botões **Minha rota** e **Agenda**.
- [ ] Abra o menu: deve ter **Início**, **Agenda**, **Campo**. **Não** deve ter Clientes, Mapa, Serviços, Rotas, Funcionários, Veículos.

**O que deve aparecer:** capa de campo, sem faixa Equipe / Visitas / Rotas / Ao vivo.

**Se falhar:** se aparecer o Centro de Operações, você entrou com papel de gestor.

---

## Roteiro 3 — Tema Claro / Escuro

**Objetivo:** o botão do tema troca a aparência.  
**Quem:** qualquer um autenticado.

- [ ] No topo, clique em **Claro** (se estiver escuro) ou **Escuro** (se estiver claro).
- [ ] No **Claro**, confira nome, **Alterar senha**, **Sair** e o título **Rotas** na sidebar (no celular: ☰ e **Fechar**).
- [ ] Clique de novo para voltar.

**O que deve aparecer:** fundo, mapa e chrome (header/menu) mudam na hora; botões do topo não somem. A preferência fica neste navegador.

**Se falhar:** o rótulo do botão é o tema *destino*, não o atual.

---

## Roteiro 4 — Centro de Operações (gestor)

**Objetivo:** ler o dia em poucos segundos.  
**Quem:** gestor. Entre de novo com o gestor se estiver no campo.

- [ ] Menu **Início**.
- [ ] Confira a faixa: **Equipe**, **Visitas**, **Rotas**, **Ao vivo**.
- [ ] Role: **O que exige atenção**, **Execução do dia**, equipe ao vivo, próximas visitas, rotas do dia.
- [ ] Se quiser, mude o **Dia** no seletor de data.
- [ ] Clique num card da faixa (ex.: **Rotas** → tela Rotas; **Ao vivo** → Mapa).

**O que deve aparecer:** números da API ou **—**. Sem alerta: “Nenhum alerta no momento.” Sem visitas: “Nenhuma visita neste dia.”

**Se falhar:** faixa vermelha = erro de rede/API. Recarregue. EMPLOYEE nesta tela não vê esses blocos (roteiro 2).

---

## Roteiro 5 — Pin da empresa (E)

**Objetivo:** o escritório ter ponto no mapa. Sem isso o planejador avisa.  
**Quem:** ADMIN (PLATFORM_ADMIN herda). SUPERVISOR / MANAGER / EMPLOYEE não têm **Empresa** no menu.

- [ ] Menu **Administração** → **Empresa**.
- [ ] A tela abre em leitura. Clique em **Editar**.
- [ ] Preencha **Razão social / Nome** se estiver vazio.
- [ ] No mapa da empresa, clique (ou arraste o pin) no local do escritório. Opcional: CEP ou **Buscar endereço**.
- [ ] Clique em **Salvar**. Deve aparecer **Salvo com sucesso.** e voltar à leitura.

**O que deve aparecer:** pin fixo no mapa em modo leitura.

**Se falhar:** **Cancelar** descarta. Sem pin ainda dá para salvar, mas o cálculo de rotas pode cair no E vazio e avisar no Planejador. MANAGER não vê este item — peça a um ADMIN.

---

## Roteiro 6 — Novo cliente (com pin)

**Objetivo:** cliente que o planejador consegue usar.  
**Quem:** ADMIN, MANAGER, SUPERVISOR (criar/ver; SUPERVISOR atualiza).

- [ ] Menu **Recursos** → **Clientes**.
- [ ] Clique em **Novo**.
- [ ] Preencha **Nome / razão social**.
- [ ] CEP é opcional (fazenda pode ficar vazio). Marque o local: clique no mapa **ou** preencha latitude/longitude.
- [ ] Clique em **Salvar**.

**O que deve aparecer:** prontuário do cliente. Na lista, localização OK. Sem pin o salvamento bloqueia com “Marque o local no mapa…”.

**Se falhar:** EMPLOYEE é mandado para Minha rota se tentar Clientes. CNPJ com 14 dígitos pode preencher sozinho (só na edição).

---

## Roteiro 7 — Novo funcionário (login de campo)

**Objetivo:** alguém que aparece no planejador e entra em **Campo**.  
**Quem:** ADMIN, MANAGER.

- [ ] Menu **Funcionários** → **Novo**.
- [ ] Preencha **Nome**, **E-mail (login)** e **Senha de acesso** (mín. 8).
- [ ] Clique em **Salvar**.

**O que deve aparecer:** detalhe do funcionário. Na lista, **Acesso** = “Com login”.

**Se falhar:** e-mail já usado → erro de e-mail existente. Sem e-mail/senha não cria. SUPERVISOR não tem este menu.

---

## Roteiro 8 — Novo veículo

**Objetivo:** placa para o Play no celular.  
**Quem:** ADMIN, MANAGER.

- [ ] Menu **Veículos** → **Novo**.
- [ ] Preencha **Placa** (obrigatória). Status disponível.
- [ ] Clique em **Salvar**.

**O que deve aparecer:** detalhe do veículo. Lista com a placa.

**Se falhar:** placa duplicada na mesma empresa. SUPERVISOR / EMPLOYEE não veem Veículos.

---

## Roteiro 9 — Mapa: pin, fazenda, adicionar à rota

**Objetivo:** o mapa como hub.  
**Quem:** ADMIN, MANAGER, SUPERVISOR.

- [ ] Menu **Mapa**.
- [ ] Na barra, clique **Clientes** — só pins. Depois **Equipe** — só carros. **Todos** — os dois.
- [ ] Clique num pin de cliente.
- [ ] No trilho (direita; no celular aba **Detalhe**), leia **Acesso à fazenda**: trilha gravada **ou** **Sem trilha de acesso**, mais a contagem de **Marcos**.
- [ ] Clique em **Adicionar à rota**.

**O que deve aparecer:** tela **Rotas**, planejador com esse cliente pré-selecionado. Marcos no mapa são ícones (porteira, ponte…), não abreviação de texto. Toque no ícone: nome + quem adicionou.

**Se falhar:** camada **Rotas** avisa até você selecionar um funcionário/rota. EMPLOYEE não tem Mapa.

---

## Roteiro 10 — Planejar e publicar

**Objetivo:** o funcionário ver a rota em **Campo**.  
**Quem:** ADMIN ou MANAGER para publicar. SUPERVISOR só vê o preview.

- [ ] Menu **Rotas** → aba **Planejador** (se ainda não estiver).
- [ ] Confirme a **data** (hoje, para o campo ver no mesmo dia).
- [ ] Marque **Voltar para a empresa no fim** se quiser retorno ao E.
- [ ] Opcional: marque **Gravar viagem** (trilha + botões Porteira/Ponte/… no celular).
- [ ] Em **Origem do cálculo**, escolha **Última localização** (F) ou **Empresa (pin E)**.
- [ ] Selecione pelo menos **um funcionário** (com login) e **um ou mais clientes** com pin.
- [ ] Espere o **RESUMO** e o bloco **ROTA 01** (sequência F ou E → 1 → 2 → E).
- [ ] Clique em **Publicar rotas**.

**O que deve aparecer:** mensagem do tipo “N rota(s) publicada(s). Os funcionários verão em Minha rota.” Aba **Rotas de hoje** lista **Rota 01** como **Publicada**.

**Se falhar**

- Sem pin da empresa / sem GPS do funcionário no modo F → aviso e fallback no E.
- SUPERVISOR: “Preview disponível. Publicar exige perfil ADMIN ou MANAGER.”
- Cliente sem pin não entra no cálculo.
- Funcionário sem login não entra na lista do planejador modo Clientes.

---

## Roteiro 10b — Missão Gravar cliente

**Objetivo:** o funcionário marca várias fazendas novas no mesmo dia e encerra quando quiser.  
**Quem:** ADMIN/MANAGER publica; EMPLOYEE executa.

- [ ] **Rotas → Planejador → Gravar cliente**.
- [ ] Data de hoje, funcionário com login, veículo. **Publicar missão de gravar**.
- [ ] Aba **Rotas de hoje**: card **Gravar acesso** (não “Sessão de gravação”).
- [ ] Login EMPLOYEE → **Campo** → **▶ Iniciar gravação** → Play (km + foto).
- [ ] Navegação: título **GRAVAR**. Sem GPS, **Adicionar ponto** fica desabilitado.
- [ ] Com GPS: **Adicionar ponto** → nome da fazenda → **Só o nome — completar depois**. Toast “Cliente marcado”; continua **Gravando**.
- [ ] Mova o GPS (ou espere) e marque um **segundo** ponto com outro nome.
- [ ] Arraste **Finalizar por completo**. O diálogo **não** pede nome. Informe km final + foto.
- [ ] Minha rota: a missão some do andamento. Se existir outra rota **Publicada**, **Iniciar** fica disponível.
- [ ] Login gestor → `/map`: dois pins; o de só nome tem **✎**. Completar cadastro tira o lápis.
- [ ] Confirme: rota clássica com **Gravar viagem** **não** mostra **Adicionar ponto**. EMPLOYEE não marca ponto em rota de outro (API 403).

**O que deve aparecer:** N clientes no mapa; missão encerrada `COMPLETED`; placeholder interno ausente em Clientes, Agenda e Serviços.

**Se falhar:** sem Play a API devolve `ROUTE_NOT_IN_PROGRESS`. Nome curto no sheet não cria ponto (rota segue gravando). Finalizar com 0 pontos é permitido.

---

## Roteiro 11 — Rotas de hoje: Gerir vs Ver

**Objetivo:** mudar a rota **antes** do Play.  
**Quem:** ADMIN/MANAGER.

- [ ] Aba **Rotas de hoje**.
- [ ] Na rota **Planejada** ou **Publicada**, clique em **Gerir**.
- [ ] No painel **Gerir rota**, experimente ↑ ↓ numa parada, ou **+ Adicionar**.
- [ ] Clique em **Salvar alterações** (ou **Fechar** se não quiser gravar).
- [ ] Não clique em **Cancelar rota** a menos que queira mesmo cancelar (pede confirmação; visitas voltam ao planejador de visitas).
- [ ] **ADMIN:** **Excluir rota** aparece se a rota **não** está Em andamento (pede confirmação; some da lista).

**O que deve aparecer:** depois do funcionário dar Play, o botão vira **Ver** — sem Salvar/Cancelar/Excluir. SUPERVISOR sempre vê **Ver**. MANAGER não vê Excluir.

**Se falhar:** rota **Em andamento** não se edita nem se exclui por aqui. Forçar DELETE pela API devolve 422 `ROUTE_IN_PROGRESS`.

---

## Roteiro 12 — Campo: iniciar rota (Play)

**Objetivo:** sair de Publicada para Em andamento.  
**Quem:** o EMPLOYEE **atribuído** à rota. **Sair** do gestor e entrar com o campo.

- [ ] Menu **Campo** (ou no Início clique **Minha rota**).
- [ ] No card da rota publicada, clique em **▶ Iniciar rota**.
- [ ] Se pedir localização, **Permitir**.
- [ ] Passo resumo: confira a ordem (com GPS, a 1ª é a mais perto). Clique **Continuar**.
- [ ] Escolha o **veículo**. **Continuar**.
- [ ] Preencha **Km inicial do veículo** e **Combustível**. **Continuar**.
- [ ] Clique em **▶ Iniciar rota**.

**O que deve aparecer:** mapa de **navegação**. Card em Minha rota vira **Em andamento**, com **Continuar navegação** e o arraste para concluir.

**Se falhar**

- “Preparando início da rota…” travado → rede.
- Já existe rota em andamento → volte a Minha rota e **conclua** a outra primeiro (“Ir para Minha rota e concluir”).
- Km vazio no confirm → “Informe o km inicial do veículo.”
- HTTP no celular: faixa **NÃO ESTÁ EM HTTPS**; o wizard **não** espera GPS; ordem = planejada; pin ao vivo pode não aparecer.
- Negar GPS no computador / HTTPS → não avança o passo de localização.

---

## Roteiro 13 — Navegar e Cheguei

**Objetivo:** abrir a visita perto da parada.  
**Quem:** EMPLOYEE com rota **Em andamento**. GPS necessário.

- [ ] Se saiu do mapa, em Minha rota clique **Continuar navegação**.
- [ ] Olhe o banner (próxima manobra / rua). HUD: **Tempo**, restante, ETA.
- [ ] Chegue perto da parada. O banner vira **Chegando em {cliente}**.
- [ ] Clique em **Cheguei**.
- [ ] Na tela **Visita**, clique em **Cheguei — chegada verificada**.

**O que deve aparecer:** “Chegada verificada” e o formulário. Com **Gravar viagem**: badge **Gravando · N pts**; botões **Porteira**, **Ponte**, **Bifurcação**, **Estrada ruim**. Perto de um marco já salvo: **Ainda existe …?** (Sim/Não). Toque no ícone lê o nome. Poucos pontos GPS: aviso âmbar — toque de novo em Cheguei para confirmar.

**Se falhar**

- Sem GPS: check-in não grava.
- **Encerrar** (✕) **não** conclui a rota — só sai da navegação.
- Banner **Cheguei** só aparece perto da parada, não no meio do caminho.

---

## Roteiro 14 — Relatório da visita e finalizar

**Objetivo:** fechar uma parada.  
**Quem:** mesmo EMPLOYEE, visita já com chegada verificada.

- [ ] Em **Resultado**, marque **Realizada** (ou outro: Cliente ausente, Sem interesse, Precisa retorno).
- [ ] Se **não** for Realizada, preencha **Observações**.
- [ ] Se for **Realizada**, clique em **Adicionar foto** e envie pelo menos uma (JPEG/PNG/WebP).
- [ ] Se **Precisa retorno**, marque remarcar e escolha data/hora futura.
- [ ] Clique em **Finalizar visita**.

**O que deve aparecer:** volta à navegação na **próxima** parada pendente. Gestor depois vê **Relatório de campo** na OS (roteiro 16).

**Se falhar**

- Realizada sem foto → não finaliza.
- Precisa retorno sem data futura → bloqueia.
- Visita já finalizada → erro.
- Sem GPS no finalizar → não envia.

---

## Roteiro 15 — Concluir a rota (arrastar)

**Objetivo:** sair de Em andamento.  
**Quem:** EMPLOYEE da rota. (ADMIN/MANAGER da mesma empresa também podem concluir pela API; na UI o arraste está no campo.)

- [ ] Termine as visitas **ou** aceite concluir incompleta.
- [ ] Em **Minha rota** (topo, inclusive rota de outro dia ainda em andamento) **ou** na navegação, arraste o controle **Arraste para concluir a rota** até o fim.
- [ ] Leia **Concluir rota?** (N de N paradas, metros restantes).
- [ ] **Sim, concluir** se todas feitas ou restam ≤ 500 m. **Sim, incompleta** se ainda falta caminho. **Cancelar** aborta.

**O que deve aparecer:** rota **Concluída** ou **Incompleta**. Paradas pendentes na incompleta ficam puladas.

**Se falhar**

- Visita ainda aberta (chegou e não finalizou) → bloqueia. Volte e **Finalizar visita**.
- Arrastar pouco e soltar → o controle volta; precisa ir quase até o fim.
- **Encerrar** no mapa não substitui este passo.

---

## Roteiro 16 — Gestor: relatório, trilha, sem Clientes no campo

**Objetivo:** fechar o ciclo no escritório e confirmar a trava do campo.  
**Quem:** gestor no roteiro A; EMPLOYEE no B.

**A — depois das visitas**

- [ ] Entre como gestor.
- [ ] **Serviços** → **Abrir** a OS do cliente.
- [ ] Na visita, leia **Relatório de campo** (resultado, chegada, saída, observações, fotos).
- [ ] **Agenda**: se remarcou “Precisa retorno”, o novo horário aparece **na data escolhida**, não na rota de hoje.
- [ ] **Rotas de hoje**: rota **Incompleta** ou **Concluída** → **Ver trilha no mapa**.
- [ ] No mapa: linha **menta** (planejado) e trilha **âmbar** (GPS real), se houver pontos.

**B — campo sem catálogo**

- [ ] Entre como EMPLOYEE.
- [ ] Confirme: não há **Clientes** no menu.
- [ ] Em Minha rota, o nome do cliente na parada **não** é link para o prontuário.

**O que deve aparecer:** evidência da visita no gestor; campo isolado do cadastro.

**Se falhar:** sem **Gravar viagem** a trilha âmbar pode não existir. Sem GPS, o relatório também não existirá (roteiros 13–14 pulados).

---

## Ordem sugerida para um ensaio ao vivo

1 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → **Sair** → 2 → 12 → 13 → 14 (repita 13–14 em cada parada) → 15 → **Sair** → 16.

Pular 5–8 se a empresa já tem pin, clientes, funcionário com login e veículo.
