# PRD UX/Funcional v0.9 — Ordens de serviço

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §3.4.

## Tela: Lista de OS

### 1. Identidade

- Rota: `/services`
- Papéis: ADMIN, MANAGER, SUPERVISOR; mutações ADMIN/MANAGER
- Arquivo: `ServicesPages.tsx` → `ServicesListPage`

### 2. Componentes

`PageHeader` + form (busca + select status) + `DataTable`.

### 3. Informação

Colunas: #, Título, Cliente, Status, Prioridade, Visitas (`visitsCount`), Abrir.

### 4. KPI / totais

`OperationalSummaryStrip` via `GET /ops/service-orders/summary`. Detalhe: `EntityContextPanel` + `GET /ops/service-orders/:id`.

### 5. Filtros e busca

- `q` título/cliente
- status: Todos / Aberta / Em andamento / Concluída / Cancelada → `GET /service-orders?q&status`

### 6. Ações

Novo (ADMIN/MANAGER) → `/services/new`; Buscar; Abrir → `/services/[id]`.

### 7. Estados

loading skeleton | empty “Nenhuma ordem de serviço.” | error

### 8. Permissões

Botão Novo só ADMIN/MANAGER. SUPERVISOR lê. EMPLOYEE sem nav.

### 9. Navegação

De: nav; mapa “Criar serviço”. Para: new / detalhe.

### 10. Mobile / PWA

Filtros empilhados `sm:flex-row`; tabela scroll.

### 11. Fora de escopo

Edição em massa; evidências.

### 12. Como testar

Filtrar status; Abrir detalhe.

---

## Tela: Nova OS

### 1. Identidade

- Rota: `/services/new` (`?customerId=` opcional)
- Papéis: ADMIN, MANAGER
- Arquivo: `ServiceOrderNewPage`

### 2. Componentes

`FormCard`: Cliente, Título, Descrição, Prioridade, Prazo, checkbox 1ª visita + datetime + funcionário.

### 3. Informação

| Campo | Obrigatório |
| --- | --- |
| Cliente | sim |
| Título | sim, min 2 |
| Descrição, Prazo | não |
| Prioridade | LOW/NORMAL/HIGH/URGENT |
| Agendar primeira visita | opcional; se marcado, início agendado obrigatório |
| Funcionário na 1ª visita | opcional |

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A (selects carregam customers/employees).

### 6. Ações

Criar ordem → `POST /service-orders` → `/services/:id`; Voltar → lista.

### 7. Estados

boot skeleton | invalid | loading | error | success redirect

### 8. Permissões

ADMIN, MANAGER.

### 9. Navegação

`?customerId=` pré-seleciona e marca “Agendar primeira visita”.

### 10. Mobile / PWA

Form full-width.

### 11. Fora de escopo

Múltiplas visitas no create (usar detalhe).

### 12. Como testar

Mapa → Criar serviço → criar com 1ª visita.

---

## Tela: Detalhe da OS

### 1. Identidade

- Rota: `/services/[id]`
- Papéis: leitura SUPERVISOR+; mutações ADMIN/MANAGER
- Arquivo: `ServiceOrderDetailPage` (em ServicesPages)

### 2. Componentes

```
PageHeader OS #n
├── card dados (cliente link, status, prioridade, prazo, endereço, descrição)
├── Cancelar ordem (manage && !cancelled)
├── lista visitas | “Nenhuma visita agendada.”
└── form Adicionar visita (manage && !cancelled)
```

### 3. Informação

Visita: início, status, funcionário, link rota se `routeStop`.
Adicionar: scheduledStart, employeeId opcional, notes.

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A.

### 6. Ações

| Ação | API |
| --- | --- |
| Cancelar ordem | `POST /service-orders/:id/cancel` (confirmação) |
| Adicionar visita | `POST /service-orders/:id/visits` |
| Link cliente | `/customers/:id` |

### 7. Estados

loading | not found | error | success msg | empty visitas

### 8. Permissões

SUPERVISOR: sem cancelar/adicionar. EMPLOYEE: sem nav OS.

### 9. Navegação

De: lista, agenda, mapa próximas visitas. Visitas alimentam `/agenda` e modo Visitas em `/routes`.

### 10. Mobile / PWA

Cards empilhados.

### 11. Fora de escopo

PATCH campos da OS nesta UI; upload evidência; check-in.

### 12. Como testar

Criar OS → 2ª visita → cancelar com confirmação.
