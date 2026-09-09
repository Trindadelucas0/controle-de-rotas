# PRD UX/Funcional v0.9 — Empresa

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §6.1.

## Tela: Empresa

### 1. Identidade

- Rota: `/settings/company`
- Papéis: ADMIN (nav + API `PATCH`); leitura via `GET /companies/me` autenticado
- Objetivo: dados da empresa + pin de origem para cálculo de rotas
- Arquivo: `CompanyAndUsers.tsx` → `CompanySettingsPage`

### 2. Componentes

```
PageHeader “Empresa”
├── msg sucesso “Salvo com sucesso.”
└── FormCard
    ├── TextFields (razão, fantasia, CNPJ, telefone, e-mail, CEP, endereço)
    ├── Buscar endereço + lista sugestões Nominatim
    ├── CustomerLocationMap (pin opcional)
    └── SelectField Status
```

### 3. Informação

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| Razão social / Nome | sim | |
| Nome fantasia | não | |
| CNPJ | não | sem lookup automático nesta tela |
| Telefone, E-mail | não | |
| CEP | não | 8 dígitos → BrasilAPI + pin |
| Buscar endereço | não | debounce Nominatim |
| Endereço (texto) | não | |
| Origem no mapa | não | pin não bloqueia salvar (aviso se faltar) |
| Status | sim | ACTIVE / INACTIVE |

### 4. KPI / totais

N/A — cadastro; pin alimenta origem em `/routes`.

### 5. Filtros e busca

Busca de endereço (Nominatim); CEP lookup. Sem filtro de lista.

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Salvar | `PATCH /api/v1/companies/me` (incl. lat/lng) |
| Clique/arraste no mapa | define pin |
| Escolher sugestão | preenche endereço + pin |

Hints CEP/endereço: loading / not_found / rate_limit / error.

### 7. Estados

| Estado | UI |
| --- | --- |
| loading | skeleton `h-40` |
| idle / saving | form |
| success | “Salvo com sucesso.” |
| error | FormError |
| empty / forbidden | N/A na UI; API 403 se não ADMIN no PATCH |

### 8. Permissões

Nav só ADMIN. Outros papéis não veem o item; URL direta → API 403 no save.

### 9. Navegação

- De: nav Empresa; home card; aviso em `/routes` se sem pin
- Para: permanece na tela; contexto de saída crítico para Rotas

### 10. Mobile / PWA

Form empilhado; mini-mapa ~280px.

### 11. Fora de escopo desta tela

Exigir pin para salvar; timezone; logo; onboarding self-service.

### 12. Como testar

1. Admin → Empresa → CEP/busca → pin → Salvar.
2. Abrir `/routes` → origem disponível.
3. Sem pin → planejador avisa e linka de volta.
