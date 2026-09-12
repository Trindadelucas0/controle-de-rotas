# PRD UX/Funcional v0.9 — Clientes

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §4.1.

## Tela: Lista de clientes

### 1. Identidade

- Rota: `/customers`
- Papéis: ADMIN, MANAGER, SUPERVISOR (listar/criar/ver; update SUPERVISOR+). EMPLOYEE: sem nav; URL redireciona para `/field/my-route`; API 403
- Objetivo: cadastro e entrada ao prontuário
- Arquivo: `CustomersPages.tsx` → `CustomersListPage`

### 2. Componentes

```
PageHeader + Novo
├── form busca (Nome, documento…)
└── DataTable | skeleton | empty contextual
```

### 3. Informação

Colunas: Nome, Documento, Cidade, OS abertas, Próxima visita, Localização (`locationStatus`), Status (`ACTIVE` / `INACTIVE` / `DRAFT` = **Em aberto**), Abrir.

### 4. KPI / totais

`OperationalSummaryStrip` alimentado por `GET /ops/customers/summary` (total, ativos, com pin, visita hoje, OS abertas, sem visita 30d).

Colunas extras: OS abertas, próxima visita (`GET /ops/customers/list-enriched`).

### 13. Dados relacionados

OS abertas e próxima visita por linha; links para prontuário.

### 14. Timeline

No detalhe: visitas persistidas via `GET /ops/customers/:id`.

### 15. KPIs

Summary strip na lista; métricas no painel do prontuário (OS abertas, visitas, última/próxima visita).

### 16. Alertas

Sem visita 30d aparece no summary (count); alerta rico WA fora de escopo.

### 17. Ações rápidas

Context card: Criar OS, Adicionar à rota, Ver histórico.

### 18. Links

Cliente ↔ OS ↔ Rotas ↔ Mapa (via ações do context card).

### 5. Filtros e busca

`q` → `GET /api/v1/customers?q=`

### 6. Ações

Novo → `/customers/new`; Abrir → `/customers/[id]`.

### 7. Estados

loading | empty “Nenhum cliente.” | error

### 8. Permissões

Todos autenticados gestores listam. Update: SUPERVISOR+. EMPLOYEE: sem catálogo; `GET/PATCH /customers/:id` só cadastro em aberto da própria missão de gravar.

### 9. Navegação

Cliente com pin → `/map`; usado em Rotas modo Clientes.

### 10. Mobile / PWA

Tabela scroll horizontal.

### 11. Fora de escopo

Importação CSV; filtro por região na lista.

### 12. Como testar

Criar com pin → aparece na lista com Localização OK.

---

## Tela: Novo / Editar cliente (prontuário)

### 1. Identidade

- Rotas: `/customers/new`, `/customers/[id]`
- Papéis: criar/ver gestores (não EMPLOYEE); update SUPERVISOR+
- Objetivo: prontuário com endereço inteligente e **pin obrigatório**
- Arquivo: `CustomerForm` + `CustomerLocationMap` + `EditableRecordShell`

### 2. Componentes

**Novo** (`/customers/new`): FormCard sempre editável.

**Detalhe** (`/customers/[id]`): abre em **modo leitura** (`DetailSection`/`DetailItem`); botão **Editar** (ícone lápis) libera o FormCard; **Cancelar** descarta e volta à leitura; **Salvar** persiste e volta à leitura.

```
PageHeader + EntityContextPanel
└── EditableRecordShell
    ├── view: seções Identificação / Contato / Endereço / Mapa (readOnly) / Classificação
    └── edit: FormCard (mesmos campos do novo)
```

### 3. Informação

| Campo | Obrigatório | Comportamento |
| --- | --- | --- |
| Nome / razão social | sim | |
| Nome fantasia | não | |
| CPF/CNPJ | não | 14 dígitos → BrasilAPI preenche + pin (só no edit) |
| Telefone, WhatsApp, E-mail | não | |
| Buscar endereço | não | debounce Nominatim (só no edit) |
| CEP | não | 8 dígitos → BrasilAPI + pin; fazendas podem deixar vazio |
| Latitude / Longitude | sim (pin) | digitação ou mapa; sincronizados |
| Endereço (rua…) | não | geocode opcional |
| Rua, Número, Complemento, Bairro, Cidade, UF | não | |
| Local no mapa | **sim** | view: pin fixo; edit: clique/arraste |
| Categoria, Prioridade, Observações | não | |
| Status | ACTIVE / INACTIVE | |

Erro sem pin: “Marque o local no mapa…”

### 4. KPI / totais

N/A.

### 5. Filtros e busca

Lookups: CNPJ, CEP, address (não são filtros de lista).

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Editar | mode=edit (só detalhe) |
| Cancelar | descarta form → mode=view |
| Salvar | `POST/PATCH /customers` — bloqueia sem pin; detalhe volta a view |
| Clique/arraste no mapa | estado lat/lng (só edit) |
| Escolher sugestão | preenche + pin |

Hints: “Buscando CNPJ…”, “CNPJ aplicado.”, “CNPJ não encontrado.”, rate_limit, etc.

### 7. Estados

| Estado | UI |
| --- | --- |
| loading detalhe | skeleton |
| view | DetailCard + Editar |
| edit / saving | FormCard |
| invalid pin | FormError |
| lookup loading/error | texto amber |
| success create | redirect `/customers/:id` |
| success update | msg “Salvo.” + view |
| empty | N/A |
| forbidden | API 403 em update sem papel |

### 8. Permissões

EMPLOYEE: sem catálogo. Update: SUPERVISOR+. Geocode no mapa operacional: ver [map.md](map.md).

### 9. Navegação

- De: lista; “Abrir prontuário” no `/map`
- Para: após criar → detalhe; pin OK → visível no mapa

### 10. Mobile / PWA

Form empilhado; mapa alto (~360px no celular; ~56vh / 420–640px no desktop). Empresa (`/settings/company`) permanece mini-mapa 280px.

### 11. Fora de escopo desta tela

Checksum CNPJ; lookup CPF; contatos múltiplos; autocomplete no `/map`.

### 12. Como testar

Abrir `[id]` → sem inputs até Editar; Cancelar descarta; Salvar atualiza a view.
1. `/customers/new` sem pin → Salvar bloqueia.
2. Clique no mapa → Salvar → aparece em `/map`.
3. CEP 01310-100 → endereço + pin.
4. Rua → sugestão → pin.
5. CNPJ 00.000.000/0001-91 → dados + pin.
