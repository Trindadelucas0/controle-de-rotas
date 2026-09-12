# Tutorial — Como o Rotas funciona

Guia para **entender** o sistema na tela. Para testar falando “clique aqui”, use o [Guia de testes](GUIA-TESTES.md).

Comportamento oficial (regras, papéis, APIs): [`DOCUMENTACAO-SISTEMA.md`](../DOCUMENTACAO-SISTEMA.md). Este tutorial **não** inventa tela nem botão.

---

## 1. O que é

O **Rotas** organiza o dia da equipe externa: cadastro de clientes, planejar o caminho, publicar para o funcionário, executar no celular (GPS, chegada, fotos) e acompanhar no mapa.

Fluxo do dia:

```text
Cadastrar → Planejar → Publicar → Executar no campo → Concluir → Ver no mapa
```

Em cadeia:

```text
Cliente  →  visita / serviço  →  parada na rota  →  funcionário + veículo
```

Não é só um mapa. O mapa é o hub para ver pins, equipe ao vivo e trilhas. A operação vive nas telas **Rotas**, **Minha rota** e **Visita**.

---

## 2. Quem entra e o que vê

No canto superior direito aparece o **nome** e o **papel** (PLATFORM_ADMIN, ADMIN, MANAGER, SUPERVISOR, EMPLOYEE).

| Papel | Quem é | O que faz na prática |
| --- | --- | --- |
| PLATFORM_ADMIN | Dono da plataforma | Tudo de ADMIN na empresa atual + **Empresas** (criar outro tenant) |
| ADMIN | Dono / TI da empresa | Cadastros, publicar rotas, **Empresa**, **Usuários** |
| MANAGER | Gestor / despachante | Mapa, cadastros, OS, rotas, acompanhar |
| SUPERVISOR | Supervisor | Ver mapa, agenda, serviços, rotas e clientes; **não** publica nem gere rota |
| EMPLOYEE | Técnico / campo | **Campo** (Minha rota), **Agenda** das próprias visitas; **sem** catálogo Clientes |

O menu some o que o papel não pode. Abrir um endereço direto sem permissão: a API recusa (403) e a tela mostra erro — não há uma página “Proibido” dedicada.

---

## 3. Tela depois do login

No celular, toque no **☰** para abrir o menu. No computador o menu fica à esquerda. No telefone a **página não dá zoom**; só o **mapa** amplia com pinça.

```text
┌─────────────────────────────────────────────────────────────┐
│ ☰  Rotas              [nome] [papel] [Claro/Escuro] [Sair]  │
├──────────┬──────────────────────────────────────────────────┤
│ OPERAÇÃO │  conteúdo da tela                                │
│ Início   │                                                  │
│ Mapa     │                                                  │
│ Agenda   │                                                  │
│ Serviços │                                                  │
│ Rotas    │                                                  │
│ Campo    │  ← só EMPLOYEE                                   │
│ RECURSOS │                                                  │
│ Clientes │  ← gestores; EMPLOYEE não vê                     │
│ Funcion. │  ← ADMIN / MANAGER                               │
│ Veículos │  ← ADMIN / MANAGER                               │
│ ADMIN    │                                                  │
│ Empresas │  ← só PLATFORM_ADMIN                             │
│ Empresa  │  ← ADMIN                                         │
│ Usuários │  ← ADMIN                                         │
└──────────┴──────────────────────────────────────────────────┘
```

Grupos reais do menu: **Operação**, **Recursos**, **Administração**.

- Gestor (ADMIN / MANAGER / SUPERVISOR / PLATFORM_ADMIN): Início abre o **Centro de Operações**.
- Campo (EMPLOYEE): Início abre **Olá, {nome}** com dois botões: **Minha rota** e **Agenda**. No menu, o item de campo se chama **Campo**.

No menu da conta:

- **Claro** / **Escuro** — o botão mostra o tema *para o qual* você vai (se está escuro, o texto é **Claro**). Header e menu acompanham o tema; **Alterar senha** e **Sair** continuam visíveis no claro.
- **Alterar senha**
- **Sair** (enquanto envia: **Saindo…**)

Cadastros (Cliente, Funcionário, Veículo, Usuário, Empresa) abrem em **leitura**. Clique em **Editar** (lápis) para mudar; **Cancelar** descarta; **Salvar** grava e volta à leitura. Telas **Novo**, login, rotas, mapa e campo já vêm com campos abertos.

---

## 4. Conceitos que evitam confusão

**Presença ≠ operação ≠ RH**

- **Presença:** o GPS chegou recentemente. No mapa: **online** (GPS há ≤ 30 s) ou **stale** (ícone mais apagado). Some depois do TTL (~120 s).
- **Operação:** o que a pessoa está fazendo no dia — em rota, em atendimento (visita depois do **Cheguei**), etc.
- **RH:** status do cadastro do funcionário (ativo, folga…). Não misture com os dois acima.

**Pin E** — ponto da empresa no mapa (Administração → **Empresa**). Serve de origem “escritório” e de volta no fim da rota se **Voltar para a empresa no fim** estiver marcado.

**Pin F** — última localização do funcionário (GPS ao vivo ou último ponto gravado). No planejador, **Origem do cálculo → Última localização** usa o F.

**Gravar viagem** — checkbox no planejador. Densifica o GPS (~2 s), grava a trilha real até cada cliente no **Cheguei**, e na navegação aparecem **Porteira / Ponte / Bifurcação / Estrada ruim**. Sem essa marca, a navegação segue normal, sem esses botões.

**Encerrar ≠ concluir** — na navegação, **Encerrar** só sai do mapa. A rota continua **Em andamento**. Para fechar o dia: arraste **Arraste para concluir a rota** em **Minha rota** ou na própria navegação.

**GPS** — check-in, finalizar visita e recálculo da linha precisam de localização. Em celular sem HTTPS o campo abre com faixa **NÃO ESTÁ EM HTTPS**: dá para **Iniciar rota** (ordem planejada), mas **Cheguei** / **Finalizar visita** não rodam sem GPS.

---

## 5. Telas do gestor

### 5.1 Início — Centro de Operações

Título **Centro de Operações** + seletor **Dia**.

Faixa de métricas (rótulos em maiúsculas na UI): **Equipe**, **Visitas**, **Rotas**, **Ao vivo**. Abaixo: **O que exige atenção**, **Execução do dia**, equipe ao vivo, próximas visitas, rotas do dia.

Clique nos cards para ir a Funcionários/Mapa, Agenda, Rotas ou Mapa. Dia vazio mostra convites para Rotas / Serviços.

### 5.2 Mapa

Camadas: **Clientes**, **Equipe**, **Rotas**, **Todos**. Trilho à direita (no celular: abas **Equipe** | **Detalhe**).

- Pin de cliente → detalhe, bloco **Acesso à fazenda** (trilha gravada *ou* **Sem trilha de acesso**) e ações da API, inclusive **Adicionar à rota**.
- Marcos (porteira, ponte, bifurcação, estrada ruim) aparecem como **ícones**, não como texto “Por” / “Bif”. Toque no ícone: nome do tipo e **quem adicionou**.
- Ao pintar a rota de um veículo, os marcos dos clientes daquela rota também aparecem.
- Ícones da equipe atualizam ~a cada 3 s.

### 5.3 Agenda

**Agenda** / visitas do dia. Escolha a **Data**, **Atualizar**. Cards com hora, status, OS, cliente, funcionário. Gestores têm **Abrir OS**. EMPLOYEE vê só as próprias e **não** tem Abrir OS.

### 5.4 Serviços

Lista de ordens. **Novo** (ADMIN/MANAGER) cria OS: cliente, título, prioridade, opcional **Agendar primeira visita**.

No detalhe da OS, cada visita finalizada mostra **Relatório de campo** (resultado, chegada, saída, observações, fotos). Visita remarcada no campo aparece na Agenda no dia escolhido — **não** entra sozinha na rota de hoje.

### 5.5 Rotas

Duas abas:

**Rotas de hoje** — cards **Rota NN**, status (**Planejada**, **Publicada**, **Em andamento**, **Concluída**, **Incompleta**…), paradas, km. Botão **Gerir** (ADMIN/MANAGER enquanto Planejada ou Publicada) ou **Ver** (depois do Play, ou SUPERVISOR). Rotas **Incompletas** / **Concluídas** têm **Ver trilha no mapa** (linha planejada menta + trilha GPS âmbar).

**Gerir rota:** data, funcionário, veículo, paradas (↑ ↓ Remover), **+ Adicionar**, **Cancelar rota**, **Salvar alterações**, **Fechar**. **ADMIN** também vê **Excluir rota** se o status não for Em andamento (some da lista). Depois do Play (**Em andamento**) não dá para salvar, cancelar nem excluir por aqui.

**Planejador** — modos **Clientes** | visitas agendadas. No modo Clientes: data, funcionários, busca de clientes, **Voltar para a empresa no fim**, **Gravar viagem**, **Origem do cálculo** (**Última localização** ou **Empresa (pin E)**). O resumo mostra km, duração e **ROTA 01** com sequência F ou E → 1 → 2 → E. **Publicar rotas** (ADMIN/MANAGER). SUPERVISOR vê o preview, sem publicar.

### 5.6 Cadastros

**Clientes** — **Novo**. Pin no mapa é **obrigatório** (CEP opcional em fazenda: use lat/lng ou clique no mapa). O mapa de localização é alto para visualizar ruas e o pin. Sem pin: “Marque o local no mapa…”.

**Funcionários** — **Novo** pede **e-mail + senha** e cria o login de campo na hora. Não existe funcionário de rota sem acesso. Coluna **Acesso**: “Com login” / “Sem login”. **Ver no mapa** foca o funcionário no mapa.

**Veículos** — **Novo** (placa obrigatória). Status típico para uso no Play: disponível.

**Empresa** — pin E. Sem pin o planejador avisa e pode cair no escritório.

**Empresas** (só PLATFORM_ADMIN) — nova empresa + admin inicial. Esse admin entra no tenant novo e só vê a empresa dele.

---

## 6. Telas de campo

### 6.1 Minha rota (menu **Campo**)

Lista as rotas **Publicada** / **Em andamento** do dia e qualquer rota ainda em andamento de outro dia.

Em cada card: status, veículo, km/tempo, paradas, **mini-mapa** da linha planejada. Nome do cliente **não** abre o prontuário.

- **▶ Iniciar rota** — só se estiver Publicada e não houver outra em andamento.
- **Continuar navegação** — se já estiver Em andamento.
- Controle **Arraste para concluir a rota**.
- **Status GPS** — tela de diagnóstico.

### 6.2 Iniciar rota (wizard)

Passos: localização → resumo (ordem mais perto → mais longe se houver GPS) → escolher veículo (último km/combustível; carro em uso por outro não aparece) → **Km inicial**, **Combustível** e **foto do odômetro** → confirmar **▶ Iniciar rota** (botão vira **Iniciando…**).

Ao **concluir**, o modal pede km final, combustível e outra foto. O app **não** avisa fraude; o gestor vê no perfil.

Em HTTP inseguro o passo de GPS é pulado: origem = 1ª parada planejada.

### 6.3 Navegar

Mapa tela cheia. Banner da próxima manobra (rua / faixa). Perto da parada o banner **Chegando…** ganha o botão **Cheguei**.

Linha menta: do carro **só até a próxima parada**. HUD: Tempo / Restante / ETA.

Com **Gravar viagem**: badge **Gravando · N pts** e os quatro botões de marco. Perto de um marco já salvo (~120 m) o app pergunta **Ainda existe porteira?** (ou o tipo): **Sim** mantém, **Não** retira. Sem Gravar viagem o banner só tem **OK**. Toque no ícone para ler o nome e quem marcou.

**Encerrar** pergunta se quer sair; a rota **não** conclui.

### 6.4 Visita

1. **Cheguei — chegada verificada** (GPS).
2. **Resultado:** Realizada · Cliente ausente · Sem interesse · Precisa retorno.
3. **Observações** — obrigatório se não for Realizada.
4. **Fotos** — pelo menos uma se Realizada (**Adicionar foto**).
5. Opcional **remarcar próxima** (obrigatório se Precisa retorno).
6. **Finalizar visita** (GPS de novo) → volta à navegação na próxima parada pendente.

Visita aberta **bloqueia** concluir a rota.

### 6.5 Concluir

Arraste até o fim → diálogo **Concluir rota?**

- Todas as paradas feitas, ou distância restante planejada ≤ **500 m** → **Sim, concluir** (`Concluída`).
- Ainda falta caminho (> 500 m) → **Sim, incompleta**. Paradas pendentes viram puladas; o gestor vê no painel + trilha no mapa.

Km final, combustível e foto do odômetro são obrigatórios no campo.

### 6.6 Missão Gravar cliente

No planejador, aba **Gravar cliente**: funcionário, data, veículo → **Publicar missão de gravar**. Não escolhe cliente na lista.

No campo o card chama **Gravar acesso**. Play → mapa **GRAVAR**. Duas ações independentes:

1. **Adicionar ponto** — nome da fazenda obrigatório no GPS atual; o resto agora ou depois. A gravação **não para**. No próximo lugar, outro ponto.
2. **Finalizar por completo** — fecha a rota quando quiser, com 0 ou N pontos. **Não** pede nome.

Cadastro só com nome fica com **lápis** no Mapa. Gestor e o funcionário dono completam depois. Se houver outra rota Publicada no dia, depois de concluir aparece **Iniciar**.

**Gravar viagem** (checkbox no modo Clientes, cliente já cadastrado) continua como estava — sem o botão Adicionar ponto.

---

## 7. Um dia típico (resumo)

1. Gestor confirma pin da **Empresa**, clientes com pin, funcionário com login, veículo.
2. **Rotas → Planejador** → marca clientes e funcionário → **Publicar rotas**.
3. Funcionário entra → **Campo** → **▶ Iniciar rota** → Play.
4. Gestor acompanha em **Início** e **Mapa**.
5. Funcionário **Cheguei** → relatório → **Finalizar visita** em cada parada.
6. Arrasta para concluir.
7. Gestor abre a OS (**Relatório de campo**) e, se incompleta, **Ver trilha no mapa**.

---

## 8. O que este tutorial não cobre

- Como ligar servidor, Docker ou atualizar VPS ([`DEV.md`](DEV.md), [`vps-atualizar.txt`](vps-atualizar.txt)).
- Contratos HTTP ([`API.md`](API.md)).
- Ficha técnica de cada tela (`docs/screens/`).
