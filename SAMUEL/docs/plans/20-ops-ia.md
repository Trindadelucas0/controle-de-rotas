# Tema 20 — IA operacional (Context Cards + home + mapa hub)

**Status:** done (28/08/2026)

**Pré-requisitos:** tracking live (11), rotas multi-dia (18).

## Escopo entregue

- Contrato TypeScript dos 7 objetos (Company, Customer, Employee, Vehicle, ServiceOrder, Route, Visit) em `apps/api/src/modules/ops/context-cards.ts`
- `GET /api/v1/ops/snapshot?date=` — resumo do dia (equipe, visitas, rotas, live, alertas)
- `GET /api/v1/ops/customers/:id` — context card do cliente + nearby com distância em metros
- Sidebar agrupada: Operação / Cadastros / Gestão
- Home `/` = Centro de Operações (ADMIN/MANAGER/SUPERVISOR); capa EMPLOYEE
- Mapa `/map` = hub full-bleed com barra data/equipe + rodapé Operação|Detalhes
- `INTERACTIONS` só no contrato/timeline (`VISIT`); sem tabela `customer_interactions`
- Sem inventar “em atendimento” / concluídas reais sem check-in

## Fora de escopo (próximos temas)

- Tema 12: visita completa `/field/visits/[id]`
- Tema 13: evidências
- Tema 14: enriquecer a mesma home com actual/ranking (não criar `/dashboard` paralelo)
- Tema 21: enriquecimento de prontuário/OS/agenda/rotas/fichas
- Tema 16: auditoria UI
- Tema 15: custos R$

## Critérios de aceite

- [x] Agregação só no backend; EMPLOYEE 403 em `/ops/*`
- [x] Sidebar com 3 grupos; mobile drawer
- [x] Home e mapa consomem o mesmo snapshot
- [x] Pin abre context + nearby em km
- [x] Docs screens + API + PRD + changelog

## Como validar

1. ADMIN → `/` → números batem com agenda/rotas do dia
2. `/map` → selecionar cliente → ações e nearby
3. SUPERVISOR vê Operação; não vê Funcionários/Usuários
4. EMPLOYEE: home sem KPIs; `/ops/snapshot` → 403
