# PRD UX/Funcional v0.9 — Veículos

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §4.3.

## Tela: Lista de veículos

### 1. Identidade

- Rotas base: `/vehicles`
- Papéis: ADMIN, MANAGER
- Objetivo: frota operacional; placa única por empresa
- Arquivo: `VehiclesPages.tsx` → `VehiclesListPage`

### 2. Componentes

```
PageHeader “Veículos” + Novo
├── form busca (placa ou modelo)
└── DataTable | skeleton | empty “Nenhum veículo.”
```

### 3. Informação

Colunas: Placa, Modelo (marca + modelo), Status, Rota hoje, Motorista, Editar.

### 4. KPI / totais

`OperationalSummaryStrip` via `GET /ops/vehicles/summary`. Colunas: rota hoje, motorista (`list-enriched`).

Detalhe: `EntityContextPanel` + `GET /ops/vehicles/:id`.

### 5. Filtros e busca

`q` → `GET /api/v1/vehicles?q=` (placa ou modelo).

### 6. Ações

Novo → `/vehicles/new`; Buscar; Editar → `/vehicles/[id]`.

### 7. Estados

loading skeleton | empty “Nenhum veículo.” | error | forbidden via API 403

### 8. Permissões

Nav ADMIN/MANAGER. SUPERVISOR/EMPLOYEE sem item; API 403.

### 9. Navegação

De: nav / home. Contexto de saída: veículos `AVAILABLE` usados no dispatch de `/routes`.

### 10. Mobile / PWA

Tabela + busca empilhados.

### 11. Fora de escopo

Telemetria, cartão combustível, associação manual rota↔veículo nesta tela.

### 12. Como testar

1. Criar veículo AVAILABLE.
2. Publicar rota em `/routes` (dispatch reutiliza veículo do dia).

---

## Tela: Novo / Editar veículo

### 1. Identidade

- Rotas: `/vehicles/new`, `/vehicles/[id]`
- Papéis: ADMIN, MANAGER
- Arquivo: `VehicleForm` + `EditableRecordShell` em `VehiclesPages.tsx`

### 2. Componentes

**Novo:** `PageHeader` + `FormCard` sempre editável.

**Detalhe `[id]`:** modo leitura (Identificação / Especificações / Situação) + botão **Editar**; Cancelar/Salvar voltam à leitura.

### 3. Informação

| Campo | Obrigatório | Notas |
| --- | --- | --- |
| Placa | sim | uppercase no submit |
| Marca, Modelo, Ano | não | |
| Combustível | não | |
| Consumo médio (km/L) | não | número |
| Capacidade | não | |
| Odômetro (km) | não | |
| Status | sim | AVAILABLE / IN_USE / MAINTENANCE / INACTIVE |

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A no form.

### 6. Ações

Editar / Cancelar (só detalhe); Salvar → `POST /vehicles` ou `PATCH /vehicles/:id`; após criar → `/vehicles/:id` (já em view).

### 7. Estados

loading detalhe (skeleton) | view | edit / saving | error (ex.: placa duplicada) | success

### 8. Permissões

ADMIN, MANAGER.

### 9. Navegação

Lista ↔ form; create redirect para detalhe.

### 10. Mobile / PWA

Form full-width.

### 11. Fora de escopo

Histórico de KM real da rota; fotos do veículo.

### 12. Como testar

Abrir `[id]` → view; Editar → Salvar → view atualizada.

1. Placa duplicada → erro API.
2. Status AVAILABLE → aparece no fluxo de rotas.
