# PRD UX/Funcional — Rotas / planejador (v0.14)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §3.5.

## Tela: Rotas

### 1. Identidade

- Rota: `/routes`
- Papéis: ADMIN, MANAGER (publicar); SUPERVISOR (preview); EMPLOYEE 403
- Objetivo: visão operacional do dia + planejador (otimização, não CRUD)
- Arquivos: `routes/page.tsx`, `RoutesTodayView.tsx`, `RoutesPlanner*.tsx`

### 2. Abas

**Rotas de hoje:** summary + lista `Rota NN — Nome`, status, N paradas, **Concluídas —**, km.

**Planejador:** modos Clientes | Visitas agendadas. No modo Clientes: checkbox **Gravar viagem** (`recordTrip`) — força 1 cliente; densifica GPS, fila local e grava trilha no check-in (retry no finalizar).

### 3. Planejador modo Clientes — layout

```
PLANEJADOR
Data · Roundtrip · Gravar viagem · Funcionários · Busca clientes
RESUMO: N funcionários · N paradas · km · duração · N rotas
ROTA 01 — JOÃO
  E → 1 → 2 → 3 → E (se roundtrip)
  totais + Remover por parada
[Publicar] (ADMIN/MANAGER)
MAPA: LineStrings (azul road / âmbar straight) + marcador E verde
```

KPI só do preview (`assignments` / `grandTotals`). Ausente → —.

### 4. Cores (inalteradas)

azul `#1d4ed8` preview estrada; âmbar `#d97706` reta; E verde empresa; teal operacional no mapa hub.

### 5. Ações / estados / permissões

Iguais à ficha anterior: preview-customers, dispatch-customers; SUPERVISOR sem Publicar; origem sem pin → aviso Empresa.

### 6. Fora de escopo

Play/GPS nesta tela; redesenho do modo Visitas nesta entrega.

### 7. Como testar

1. Selecionar funcs + clientes → RESUMO + ROTA 01 — nome + E→1→…
2. Roundtrip → volta E.
3. Straight_line → aviso âmbar.
4. SUPERVISOR: preview sem Publicar.
