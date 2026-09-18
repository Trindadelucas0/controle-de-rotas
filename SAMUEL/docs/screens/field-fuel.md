# PRD UX/Funcional — Abastecimento no campo

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §5.1b.

## Tela: `/field/fuel-new`

### 1. Identidade

- Papéis: EMPLOYEE (link em Minha rota). Sem item no dashboard de custos.
- Objetivo: registrar km, litros, preço e foto (se a empresa exigir). Sem OCR.
- Arquivo: `FieldFuelPage.tsx`
- API: `POST /field/fuel-fills` (mesmo service do escritório)

### 2. Componentes

Formulário coluna única: veículo (lista `GET /field/vehicles`), km, litros, R$/L, total calculado (não digitável), `OdometerPhotoCapture`, Registrar / Cancelar.

### 7. Estados

Sucesso: “Abastecimento registrado” + voltar para Minha rota. Validação 422 litros/preço/comprovante. 404 veículo de outro tenant.
