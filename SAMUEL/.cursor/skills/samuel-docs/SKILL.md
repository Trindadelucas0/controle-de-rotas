---
name: samuel-docs
description: >-
  Documentação contínua do SAMUEL: templates obrigatórios por tela, endpoint e
  bugfix, mais checklist ponta solta. Auto-aplicável em qualquer tarefa neste
  repositório que crie ou altere tela, API, correção ou tema.
---

# Skill — Documentação contínua SAMUEL (`samuel-docs`)

## Quando aplicar

Sempre que, neste repositório (`SAMUEL`):

- criar ou alterar uma **tela** (rota Next.js);
- criar ou alterar um **endpoint** da API;
- corrigir um **bug** com mudança de comportamento;
- fechar ou avançar um **tema** em `docs/plans/`.

Sem documentação correspondente = tema incompleto. Sem checklist ponta solta = não fechar o tema.

## Onde gravar

| Tipo | Destino |
| --- | --- |
| Tela | `docs/screens/{slug}.md` + índice em `docs/modules/{modulo}.md` |
| Endpoint | Seção em `docs/API.md` e/ou `docs/modules/{modulo}.md` |
| Bugfix | Entrada em `docs/CHANGELOG.md` + bloco Fix abaixo (pode ficar no PR/chat e resumido no CHANGELOG) |
| Tema | `docs/plans/NN-*.md` com status e inventário de telas |

---

## Template — Tela

Copiar para `docs/screens/{slug}.md`:

```markdown
## Tela: {nome}

- Rota:
- Papéis que acessam:
- Objetivo:
- Layout (blocos):
- Campos (nome, tipo, validação, erro):
- Ações / botões:
- Estados: idle | loading | success | error | empty | forbidden
- Chamadas de API:
- Redirects:
- Mobile / PWA:
- Acessibilidade (labels, focus, enter):
- Fora de escopo desta tela:
- Como testar:
```

Preencher cada bullet. Estados não usados marcar como N/A com motivo.

---

## Template — Endpoint

Copiar para a seção correspondente em `docs/API.md` / `docs/modules/*.md`:

```markdown
## Endpoint METHOD /path

- Auth:
- Rate limit:
- Body / Query:
- Cookies set/clear:
- Respostas 2xx / 4xx / 5xx (JSON exemplo):
- Side effects (DB, Redis, audit):
- Como testar:
```

Erro padrão do projeto:

```json
{ "statusCode": 401, "code": "AUTH_INVALID_CREDENTIALS", "message": "E-mail ou senha inválidos." }
```

---

## Template — Bug fix

```markdown
## Fix

- Sintoma:
- Causa raiz:
- Arquivos:
- Como validar:
```

Registrar versão/tema no `docs/CHANGELOG.md`.

---

## Checklist ponta solta (fechar tema)

### Por tela

- [ ] Documentada em `docs/screens/*.md`
- [ ] Cada estado relevante testado (idle/loading/error/success/invalid/empty/forbidden)
- [ ] Mobile ~375px utilizável
- [ ] Labels/aria em campos sensíveis e alertas de erro
- [ ] Fora de escopo explícito

### Por API

- [ ] Endpoint documentado com exemplos JSON
- [ ] Auth / rate limit / cookies descritos
- [ ] Side effects (DB, Redis, audit) listados
- [ ] Validação no backend (não só no cliente)

### Segurança / env

- [ ] Secrets só em `.env` (não commitados)
- [ ] `.env.example` atualizado se novas vars
- [ ] Sem `NEXT_PUBLIC_` de secret
- [ ] CORS restrito a `CORS_ORIGIN`

### Encerramento

- [ ] `docs/CHANGELOG.md` atualizado
- [ ] `docs/modules/{modulo}.md` índice atualizado
- [ ] `docs/plans/NN-*.md` status coerente (ex.: done)
- [ ] Nada entregue sem doc correspondente

---

## Regra rápida

1. Implementar.
2. Documentar com o template certo.
3. Passar o checklist ponta solta.
4. Só então marcar o tema/plano como done.
