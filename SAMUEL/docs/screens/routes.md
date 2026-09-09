# PRD UX/Funcional — Rotas / planejador (v0.16.4)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §3.5.

## Tela: Rotas

### 1. Identidade

- Rota: `/routes`
- Papéis: ADMIN, MANAGER (publicar); SUPERVISOR (preview); EMPLOYEE 403
- Objetivo: visão operacional do dia + planejador (otimização, não CRUD)
- Arquivos: `routes/page.tsx`, `RoutesTodayView.tsx`, `RoutesPlanner*.tsx`

### 2. Abas

**Rotas de hoje:** summary + lista `Rota NN — Nome`, status, N paradas, **Concluídas —**, km.

**Planejador:** modos Clientes | Visitas agendadas. No modo Clientes: checkbox **Gravar viagem** (`recordTrip`) — força 1 cliente; densifica GPS, fila local e grava trilha no check-in (retry no finalizar). Seletor **Origem do cálculo**: última localização do funcionário (padrão) ou pin da empresa.

### 3. Planejador modo Clientes — layout

```
PLANEJADOR
Data · Roundtrip · Gravar viagem · Origem do cálculo (F | E) · Funcionários · Busca clientes
RESUMO: N funcionários · N paradas · km · duração · N rotas
ROTA 01 — JOÃO
  F ou E → 1 → 2 → 3 → E (se roundtrip)
  totais + Remover por parada
[Publicar] (ADMIN/MANAGER)
MAPA: LineStrings + F (última loc.) + E (empresa, se roundtrip ou modo Empresa)
```

KPI só do preview (`assignments` / `grandTotals`). Ausente → —.

### 4. Cores (inalteradas)

azul `#1d4ed8` preview estrada; âmbar `#d97706` reta; E verde/laranja empresa; F pin do funcionário; teal operacional no mapa hub.

### 5. Ações / estados / permissões

Iguais à ficha anterior: preview-customers, dispatch-customers (`originMode`); SUPERVISOR sem Publicar; origem sem pin → aviso Empresa. Sem GPS no modo última loc. → aviso + fallback E.

### 6. Fora de escopo

Play/GPS nesta tela; redesenho do modo Visitas nesta entrega (continua origem empresa).

### 7. Como testar

1. Selecionar funcs + clientes → RESUMO + ROTA 01 — nome + F/E→1→…
2. Alternar Origem do cálculo → km e estimativa mudam se houver GPS.
3. Roundtrip → volta E nos dois modos.
4. Sem GPS + última loc. → aviso âmbar, cálculo pelo E.
5. SUPERVISOR: preview sem Publicar.
