# Módulo Employees

CRUD de funcionários (Tema 03) + **login de campo** (Tema 17). Isolamento por `companyId` do JWT.

`Employee.userId` continua **nullable** no banco: legado sem login existe, mas **não** entra no despacho por clientes (`EMPLOYEE_LOGIN_REQUIRED`).

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
- Body (parcial): campos de perfil; opcionalmente `email` + `password` para **criar acesso** se ainda não houver `userId`

### Respostas

**200:** `{ employee }`

**400:** `EMPLOYEE_ALREADY_HAS_LOGIN` — já tem usuário (reset em Usuários); `EMPLOYEE_LOGIN_EMAIL_REQUIRED` — pediu senha sem e-mail

**404:** `EMPLOYEE_NOT_FOUND`

**409:** `USER_EMAIL_EXISTS`

- Side effects: se `password` e sem `userId`, cria User EMPLOYEE e vincula; senão só atualiza perfil
- Como testar: editar funcionário “Sem login” → Criar acesso → aparece no planner de rotas
