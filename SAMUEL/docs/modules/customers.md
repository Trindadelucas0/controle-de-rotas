# Módulo Customers

CRUD de clientes (Tema 04 + 06b). ADMIN/MANAGER/SUPERVISOR listam/criam/veem; update SUPERVISOR+. **EMPLOYEE sem catálogo** (403); landmarks em rota `IN_PROGRESS` mantidos.

Formulário web exige pin (mapa ou CEP/endereço/CNPJ). Lookups: [lookups.md](lookups.md).

## Endpoints

| Método | Path | Papéis |
| --- | --- | --- |
| GET | `/api/v1/customers` | ADMIN, MANAGER, SUPERVISOR |
| POST | `/api/v1/customers` | ADMIN, MANAGER, SUPERVISOR |
| GET | `/api/v1/customers/:id` | ADMIN, MANAGER, SUPERVISOR |
| PATCH | `/api/v1/customers/:id` | ADMIN, MANAGER, SUPERVISOR |
| POST | `/api/v1/customers/:id/geocode` | ADMIN, MANAGER |
| POST | `/api/v1/customers/:id/landmarks` | ADMIN, MANAGER, EMPLOYEE* |
| DELETE | `/api/v1/customers/:id/landmarks/:landmarkId` | ADMIN, MANAGER, EMPLOYEE* |
| GET | `/api/v1/customers/:id/access` | ADMIN, MANAGER |

\* EMPLOYEE só com rota `IN_PROGRESS` e parada desse cliente.

Contratos em [API.md](../API.md). Tela: [screens/customers.md](../screens/customers.md).
