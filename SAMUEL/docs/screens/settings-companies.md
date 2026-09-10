# Empresas (plataforma)

| | |
|---|---|
| Rota | `/settings/companies`, `/settings/companies/new`, `/settings/companies/[id]` |
| Papel | `PLATFORM_ADMIN` |
| API | `GET/POST /companies`, `GET/PATCH /companies/:id` |

## Objetivo

Provisionar tenants: listar empresas, criar empresa + administrador inicial, editar metadados/status.

## Ações

- **Nova empresa** — nome (+ opcionais) + admin nome/e-mail/senha (≥8).
- **Abrir** — editar dados e status ACTIVE/INACTIVE.
- Isolamento: o admin criado faz login só no novo tenant; dados operacionais não cruzam.

## Fora de escopo

- Signup público
- Troca de tenant no mesmo login
- Impersonation
