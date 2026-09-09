# Módulo Customers

CRUD de clientes (Tema 04 + 06b). EMPLOYEE pode listar/criar/ver; update só ADMIN/MANAGER/SUPERVISOR.

Formulário web exige pin (mapa ou CEP/endereço/CNPJ). Lookups: [lookups.md](lookups.md).

## Endpoints

| Método | Path | Papéis |
| --- | --- | --- |
| GET | `/api/v1/customers` | ADMIN, MANAGER, SUPERVISOR, EMPLOYEE |
| POST | `/api/v1/customers` | ADMIN, MANAGER, SUPERVISOR, EMPLOYEE |
| GET | `/api/v1/customers/:id` | ADMIN, MANAGER, SUPERVISOR, EMPLOYEE |
| PATCH | `/api/v1/customers/:id` | ADMIN, MANAGER, SUPERVISOR |
| POST | `/api/v1/customers/:id/geocode` | ADMIN, MANAGER |

Contratos em [API.md](../API.md). Tela: [screens/customers.md](../screens/customers.md).
