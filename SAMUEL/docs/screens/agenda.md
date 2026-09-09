# PRD UX/Funcional v0.9 — Agenda

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §3.3.

## Tela: Agenda

### 1. Identidade

- Rota: `/agenda`
- Papéis: ADMIN, MANAGER, SUPERVISOR, EMPLOYEE (próprias visitas via API)
- Objetivo: visitas do dia com OS, cliente, funcionário e status
- Arquivo: `AgendaPage.tsx`

### 2. Componentes

```
PageHeader “Agenda” / “Visitas do dia”
├── date picker + botão Atualizar
└── lista cards | skeleton | empty “Nenhuma visita neste dia.”
```

### 3. Informação (card)

- Hora local + label status visita
- OS # — título
- Cliente (tradeName || name)
- Funcionário ou “Sem funcionário atribuído”
- Botão Abrir OS (não-EMPLOYEE)

### 4. KPI / totais

`OperationalSummaryStrip` via `GET /ops/agenda/summary` (planejadas, concluídas, em andamento, atrasadas, canceladas).

### 5. Filtros e busca

Filtro único: **Data** (`type=date`) → `GET /visits?from&to` (início/fim do dia local).

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Mudar data / Atualizar | reload |
| Abrir OS | `/services/[id]` se ADMIN/MANAGER/SUPERVISOR |

### 7. Estados

| Estado | UI |
| --- | --- |
| loading | skeleton `h-32` |
| empty | “Nenhuma visita neste dia.” |
| error | texto vermelho |
| forbidden | N/A na UI; API filtra EMPLOYEE |

### 8. Permissões

EMPLOYEE vê só as próprias (backend); sem Abrir OS.

### 9. Navegação

De: nav; Minha rota “Ver agenda” (empty). Para: detalhe OS.

### 10. Mobile / PWA

Cards empilhados ~375px.

### 11. Fora de escopo

Drag-and-drop, visão semana/mês, edição inline.

### 12. Como testar

1. Criar OS com visitas em datas conhecidas.
2. Agenda → dia → ver itens.
3. EMPLOYEE → só as próprias; sem Abrir OS.
