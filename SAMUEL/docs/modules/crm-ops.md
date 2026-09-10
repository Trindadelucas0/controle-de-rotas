# Módulo — Companies / Users / Employees / Customers / Vehicles

Temas 02–05. Isolamento por `companyId` do JWT. Sem PostGIS.

## Companies

- `GET /api/v1/companies/me` — autenticado
- `PATCH /api/v1/companies/me` — ADMIN

Telas: `/settings/company`

## Users

- `GET/POST /api/v1/users` — ADMIN
- `GET/PATCH /api/v1/users/:id` — ADMIN
- `POST /api/v1/users/:id/reset-password` — ADMIN

Telas: `/settings/users`, `/settings/users/new`, `/settings/users/[id]`

## Employees

- CRUD `/api/v1/employees` — ADMIN, MANAGER
- Create: `email` + `password` obrigatórios (User EMPLOYEE + vínculo); edição sem login também exige e-mail + senha
- Detalhes: [employees.md](employees.md) · [screens/employees.md](../screens/employees.md)

Telas: `/employees`, `/employees/new`, `/employees/[id]`

## Customers

- CRUD `/api/v1/customers` — ADMIN, MANAGER, SUPERVISOR (listar/criar/ver/update); EMPLOYEE **sem** catálogo (403); landmarks EMPLOYEE só em rota IN_PROGRESS
- `locationStatus`: OK se lat+lng; senão PENDING

Telas: `/customers`, `/customers/new`, `/customers/[id]`

## Vehicles

- CRUD `/api/v1/vehicles` — ADMIN, MANAGER
- Placa única por empresa

Telas: `/vehicles`, `/vehicles/new`, `/vehicles/[id]`

## Checklist ponta solta

- [x] Migration Prisma aplicada
- [x] Guards + Roles
- [x] Telas + nav
- [x] Build API + Web OK
- [ ] Teste manual login → CRUD no browser (validar com `npm run dev`)
