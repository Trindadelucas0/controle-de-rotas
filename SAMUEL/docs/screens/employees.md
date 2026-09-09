# PRD UX/Funcional v0.9 — Funcionários

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §4.2.

## Tela: Lista de funcionários

### 1. Identidade

- Rota: `/employees`
- Papéis: ADMIN, MANAGER
- Objetivo: equipe de campo; coluna de acesso (login) para rotas `/field/*`
- Arquivo: `EmployeesPages.tsx` → `EmployeesListPage`

### 2. Componentes

```
PageHeader + Novo
├── form busca
└── DataTable | skeleton | empty “Nenhum funcionário.”
```

### 3. Informação

Colunas: Nome, Cargo, Status (RH), Operacional, Rota hoje, Acesso (“Com login” / “Sem login”), Editar.

### 4. KPI / totais

`OperationalSummaryStrip` via `GET /ops/employees/summary`. Colunas: operacional (live), rota hoje, placa (`list-enriched`).

### 13–18. Painel operacional

Detalhe: `EntityContextPanel` + `GET /ops/employees/:id` (rota do dia, timeline visitas, GPS se online).

### 5. Filtros e busca

`q` → `GET /api/v1/employees?q=`

### 6. Ações

Novo → `/employees/new`; Buscar; Editar → `/employees/[id]`.

### 7. Estados

loading | empty “Nenhum funcionário.” | error | forbidden API 403

### 8. Permissões

ADMIN, MANAGER na nav/API.

### 9. Navegação

Só quem tem `userId` entra no planejador modo Clientes.

### 10. Mobile / PWA

~375px utilizável.

### 11. Fora de escopo

Presence ONLINE/OFFLINE; matching por especialidade.

### 12. Como testar

Lista mostra “Com login” para seed `employee@demo.local`.

---

## Tela: Novo funcionário

### 1. Identidade

- Rota: `/employees/new`
- Papéis: ADMIN, MANAGER
- Objetivo: cadastro + User EMPLOYEE na mesma transação
- Arquivo: `NewEmployeePage` + `EmployeeForm` mode=create

### 2. Componentes

`PageHeader` (“Cria o cadastro e o login de campo…”) + `FormCard` + `PasswordField`.

### 3. Informação

| Campo | Obrigatório |
| --- | --- |
| Nome | sim |
| Telefone | não |
| E-mail (login) | sim |
| Senha de acesso | sim, min 8 |
| Cargo, Matrícula, Especialidades (CSV), Região | não |
| Status | ACTIVE / INACTIVE / ON_LEAVE / SUSPENDED |

Sem campo User ID cru.

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A.

### 6. Ações

Salvar → `POST /api/v1/employees` `{ name, email, password, … }` → `/employees/:id`

### 7. Estados

idle | loading | error (`USER_EMAIL_EXISTS` 409, etc.) | success redirect

### 8. Permissões

ADMIN, MANAGER.

### 9. Navegação

Após criar, editar; login EMPLOYEE em `/login`.

### 10. Mobile / PWA

Form empilhado; labels em e-mail/senha.

### 11. Fora de escopo

Reset de senha inline (vai em Usuários).

### 12. Como testar

1. Novo com e-mail+senha → login EMPLOYEE.
2. E-mail duplicado → 409.

---

## Tela: Editar funcionário

### 1. Identidade

- Rota: `/employees/[id]`
- Papéis: ADMIN, MANAGER
- Arquivo: `EditEmployeePage` + `EmployeeForm` mode=edit

### 2. Componentes

Form perfil + bloco Acesso:

- Com login: e-mail somente leitura; link “Redefinir senha em Usuários” (ADMIN → `/settings/users/:userId`); MANAGER vê texto pedindo admin
- Sem login: checkbox “Criar acesso ao Rotas” → e-mail + senha

### 3. Informação

Mesmos campos de perfil; status RH (não Presence).

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A.

### 6. Ações

Salvar → `PATCH /employees/:id` (com `password` cria acesso se sem `userId`).

### 7. Estados

loading skeleton | error load | success msg | error `EMPLOYEE_ALREADY_HAS_LOGIN`

### 8. Permissões

ADMIN/MANAGER; reset senha só ADMIN via Usuários.

### 9. Navegação

Para Usuários se já tem login (ADMIN).

### 10. Mobile / PWA

Fieldset Criar acesso empilhado.

### 11. Fora de escopo

Tornar `userId` NOT NULL no banco.

### 12. Como testar

1. Legado sem login → Criar acesso → aparece no planner.
2. Já com login + password no PATCH → `EMPLOYEE_ALREADY_HAS_LOGIN`.
