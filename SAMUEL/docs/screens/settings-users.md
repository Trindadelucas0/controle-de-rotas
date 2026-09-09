# PRD UX/Funcional v0.9 — Usuários

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §6.2.

## Tela: Lista de usuários

### 1. Identidade

- Rota: `/settings/users`
- Papéis: ADMIN
- Objetivo: listar contas de acesso da empresa
- Arquivo: `CompanyAndUsers.tsx` → `UsersListPage`

### 2. Componentes

```
PageHeader “Usuários” + action Novo usuário
├── form busca (nome/e-mail)
└── DataTable | skeleton | empty
```

### 3. Informação

Colunas: Nome, E-mail, Perfil, Status, link Editar.

### 4. KPI / totais

N/A — lista CRUD sem contadores.

### 5. Filtros e busca

Busca `q` (nome ou e-mail) → `GET /api/v1/users?q=`

### 6. Ações

| Ação | Destino |
| --- | --- |
| Novo usuário | `/settings/users/new` |
| Buscar | reload lista |
| Editar | `/settings/users/[id]` |

### 7. Estados

| Estado | UI |
| --- | --- |
| loading | skeleton `h-32` |
| empty | “Nenhum usuário encontrado.” |
| error | texto vermelho |
| forbidden | API 403 (nav oculta para não-ADMIN) |

### 8. Permissões

Só ADMIN na nav e na API.

### 9. Navegação

De: nav / home. Para: new / edit.

### 10. Mobile / PWA

Tabela com scroll; busca full-width.

### 11. Fora de escopo desta tela

Vínculo automático User↔Employee (feito em Funcionários).

### 12. Como testar

1. Admin → Usuários → lista seed.
2. Buscar por e-mail.
3. EMPLOYEE abre URL → 403 API.

---

## Tela: Novo usuário

### 1. Identidade

- Rota: `/settings/users/new`
- Papéis: ADMIN
- Arquivo: `NewUserPage.tsx`

### 2. Componentes

`PageHeader` + `FormCard`: Nome, E-mail, Perfil (select), Senha inicial (`PasswordField`).

### 3. Informação

| Campo | Obrigatório |
| --- | --- |
| Nome | sim |
| E-mail | sim |
| Perfil | ADMIN / MANAGER / SUPERVISOR / EMPLOYEE (default EMPLOYEE) |
| Senha inicial | sim (PasswordField) |

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A.

### 6. Ações

Criar → `POST /api/v1/users` → `/settings/users/:id`

### 7. Estados

idle | loading | error | success (redirect)

### 8. Permissões

ADMIN.

### 9. Navegação

De: lista. Para: detalhe após criar.

### 10. Mobile / PWA

Form empilhado.

### 11. Fora de escopo

Criar Employee junto (usar `/employees/new` para campo).

### 12. Como testar

Criar EMPLOYEE → logar com senha inicial.

---

## Tela: Editar usuário

### 1. Identidade

- Rota: `/settings/users/[id]`
- Papéis: ADMIN
- Arquivo: `EditUserPage.tsx`

### 2. Componentes

```
PageHeader “Editar usuário”
├── msg sucesso
├── FormCard Salvar: Nome, Perfil, Status
└── FormCard Redefinir senha: Nova senha
```

### 3. Informação

- Status: ACTIVE / INACTIVE / SUSPENDED
- Perfil: quatro roles
- Reset: nova senha; “Define uma nova senha e força novo login.”

### 4. KPI / totais

N/A. Campo `lastLoginAt` existe no DTO mas **não** é exibido nesta UI.

### 5. Filtros e busca

N/A.

### 6. Ações

| Ação | API |
| --- | --- |
| Salvar | `PATCH /users/:id` |
| Redefinir senha | `POST /users/:id/reset-password` |

### 7. Estados

loading skeleton | error load | saving | resetting | success msgs

### 8. Permissões

ADMIN. Link “Redefinir senha em Usuários” a partir de Funcionários (só ADMIN).

### 9. Navegação

De: lista; link em `/employees/[id]` quando há `userId`.

### 10. Mobile / PWA

Dois FormCards empilhados.

### 11. Fora de escopo

Editar e-mail; MFA.

### 12. Como testar

1. Editar role/status → Salvar.
2. Redefinir senha → sessões revogadas → login com nova.
