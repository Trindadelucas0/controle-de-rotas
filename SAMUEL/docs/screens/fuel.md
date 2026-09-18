# PRD UX/Funcional — Abastecimentos

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §4.4.

## Tela: Lista `/fuel`

### 1. Identidade

- Papéis: ADMIN, MANAGER, SUPERVISOR (nav). EMPLOYEE não vê o item; API lista só os que ele criou.
- Objetivo: histórico paginado de combustível REAL (não estimativa).
- Arquivo: `FuelPages.tsx` → `FuelListPage`

### 2. Componentes

```
PageHeader “Abastecimentos” + Novo (ADMIN/MANAGER)
├── filtros: período, veículo, busca
├── DataTable | skeleton | empty “Nenhum abastecimento no período.”
└── total do período (soma ACTIVE)
```

### 3. Informação

Data, placa, km, litros, R$/L, total (servidor), posto, status, comprovante.

### 6. Ações

Novo → `/fuel/new`. Linha → `/fuel/[id]`.

### 7. Estados

LOADING skeleton · EMPTY copy acima · ERROR faixa · 403 EMPLOYEE na nav some.

## Tela: Novo `/fuel/new`

Veículo, data/hora, km, litros, preço/L, posto, forma de pagamento, notas, foto (obrigatória se Empresa exigir comprovante). Total = preview litros × preço; o servidor grava o total. Confirmar desabilitado sem veículo/litros/preço.

## Tela: Detalhe `/fuel/[id]`

Leitura + comprovante. ADMIN: Cancelar (soft). ADMIN/MANAGER: correção de campos no PATCH (escritório).
