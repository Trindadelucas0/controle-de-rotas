# Módulo Employees

CRUD de funcionários (Tema 03) + **login de campo** (Tema 17). Isolamento por `companyId` do JWT.

`Employee.userId` continua **nullable** no banco (legado). Cadastro novo e edição de quem ainda não tem login **exigem** e-mail + senha: cria `User` EMPLOYEE. Sem usuário de acesso o PATCH falha (`EMPLOYEE_LOGIN_REQUIRED`). Sem login **não** entra no despacho por clientes.

## Telas

| Rota | Doc |
| --- | --- |
| `/employees`, `/employees/new`, `/employees/[id]` | [screens/employees.md](../screens/employees.md) |

## Endpoints

| Método | Path | Papéis |
| --- | --- | --- |
| GET | `/api/v1/employees` | ADMIN, MANAGER |
| POST | `/api/v1/employees` | ADMIN, MANAGER |
| GET | `/api/v1/employees/:id` | ADMIN, MANAGER |
| PATCH | `/api/v1/employees/:id` | ADMIN, MANAGER |

---

## Endpoint POST /api/v1/employees

- Auth: ADMIN, MANAGER (JWT)
- Rate limit: N/A (além do auth global)
- Body:

```json
{
  "name": "Ana Silva",
  "email": "ana@empresa.com",
  "password": "senha-min-8",
  "phone": null,
  "jobTitle": "Técnica",
  "registration": null,
  "specialties": ["elétrica"],
  "region": "Zona Sul",
  "status": "ACTIVE"
}
```

- `email` + `password` (mín. 8) **obrigatórios**
- Cookies: N/A

### Respostas

**201/200:** `{ employee }` — inclui `userId`; **nunca** retorna hash de senha

**409:** `USER_EMAIL_EXISTS` — e-mail já em uso; `EMPLOYEE_USER_LINKED` — usuário já vinculado a outro employee

- Side effects: transação cria `User` papel `EMPLOYEE` (via `UsersService.create`) + `Employee` com `userId`
- Como testar: criar em `/employees/new` → login em `/login` → acessar `/field/my-route`

---

## Endpoint PATCH /api/v1/employees/:id

- Auth: ADMIN, MANAGER
- Body (parcial): campos de perfil. Se ainda **não** houver `userId`, `email` + `password` são **obrigatórios** (cria User EMPLOYEE). Já com login, senha não vai neste PATCH.

### Respostas

**200:** `{ employee }`

**400:** `EMPLOYEE_ALREADY_HAS_LOGIN` — já tem usuário (reset em Usuários); `EMPLOYEE_LOGIN_REQUIRED` — sem `userId` e sem senha; `EMPLOYEE_LOGIN_EMAIL_REQUIRED` — senha sem e-mail

**404:** `EMPLOYEE_NOT_FOUND`

**409:** `USER_EMAIL_EXISTS`

- Side effects: se ainda sem `userId`, cria User EMPLOYEE e vincula; senão só atualiza perfil
- Como testar: editar funcionário “Sem login” → e-mail + senha → aparece no planner; salvar sem senha → `EMPLOYEE_LOGIN_REQUIRED`
