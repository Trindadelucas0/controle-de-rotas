# Módulo Users

CRUD de usuários da empresa (Tema 02). Sempre escopo `companyId` JWT; nunca retorna `passwordHash`.

## Endpoints

| Método | Path | Papéis |
| --- | --- | --- |
| GET | `/api/v1/users` | ADMIN |
| POST | `/api/v1/users` | ADMIN |
| GET | `/api/v1/users/:id` | ADMIN |
| PATCH | `/api/v1/users/:id` | ADMIN |
| POST | `/api/v1/users/:id/reset-password` | ADMIN |

Contratos em [API.md](../API.md).
