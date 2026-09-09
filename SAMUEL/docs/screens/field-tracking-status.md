# PRD UX/Funcional v0.9 — Status GPS (campo)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §5.4.

## Tela: Status do GPS

### 1. Identidade

- Rota: `/field/tracking-status`
- Papéis: EMPLOYEE
- Objetivo: diagnosticar permissão GPS e sessão de tracking HTTP
- Arquivo: `FieldTrackingStatusPage.tsx`

### 2. Componentes

```
section
├── H1 “Status do GPS” + link ← Minha rota
├── erro API (se houver)
└── card
    ├── Transporte (HTTP, sem WebSocket)
    ├── Sessão (ativa/inativa + rota + placa)
    ├── App (PWA standalone vs aba)
    ├── Navegador (PermissionStatus geolocation)
    └── hint da API (se houver)
```

### 3. Informação

| Bloco | Conteúdo |
| --- | --- |
| Transporte | “Localização via HTTP (`POST /tracking/points`). Sem WebSocket neste bloco.” |
| Sessão | Ativa · rota id curto · veículo placa **ou** “Inativa — inicie a rota com Play” **ou** “Carregando…” |
| App | “App instalado (tela inicial)” ou “Navegador em aba…” |
| Navegador | `Permissão GPS: {granted\|denied\|prompt}` ou fallback |
| Hint | texto opcional da API |

### 4. KPI / totais

N/A numérico — indicador binário sessão ativa/inativa + placa.

### 5. Filtros e busca

N/A.

### 6. Ações

| Ação | Efeito |
| --- | --- |
| ← Minha rota | `/field/my-route` |
| Load | `GET /api/v1/field/tracking-status` + `navigator.permissions.query(geolocation)` |

Sem botão de iniciar tracking nesta tela.

### 7. Estados

| Estado | UI |
| --- | --- |
| loading data | “Carregando…” na sessão |
| error | borda vermelha |
| trackingActive true/false | textos acima |
| geo unsupported | “Geolocation não suportada” |

### 8. Permissões

EMPLOYEE. Não é o mapa ao vivo do gestor.

### 9. Navegação

De: link Status GPS em Minha rota. Para: Minha rota.

### 10. Mobile / PWA

Diagnóstico no PWA após Play. Layout também passa pela trava `FieldPwaLocationGate`.

### 11. Fora de escopo

Mapa ao vivo; conceder GPS sem o diálogo do sistema; WebSocket.

### 12. Como testar

1. Sem Play → sessão inativa.
2. Após start → sessão ativa + permissão granted (se permitido).
3. Negar GPS no browser → estado denied.
