# PRD UX/Funcional v0.9 — Chrome (shell)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §1.

## Tela: Chrome compartilhado (não é rota)

### 1. Identidade

- Rotas cobertas: autenticadas **exceto** `/field/navigate` e `/field/visits/[id]`
- Papéis: conforme item da nav
- Objetivo: navegação Operação · Recursos · Administração + sessão
- Arquivos: `(app)/layout.tsx`, `AppHeader.tsx`, `AppSidebar.tsx`, `AppBottomNav.tsx`, `AppMoreSheet.tsx`, `AppNav.tsx`, `nav-primary.ts`, `UserMenu.tsx`

### 2. Componentes

```
SidebarProvider
├── AppSidebar (só md+): Rotas + empresa + grupos Lucide
└── SidebarInset
    ├── AppHeader: safe-area-top | UserMenu
    ├── conteúdo: full-bleed em `/` e `/map`; senão max-w-5xl + app-main-pad
    └── AppBottomNav (só <md): primários + Mais → AppMoreSheet
```

Chrome usa `--surface` / `--sidebar` e `data-theme`. Campo tela cheia (`field-nav`) permanece HUD escuro, **sem** `SidebarProvider`/bottom nav.

### 3. Informação

Grupos: **Operação** · **Recursos** · **Administração** (mesmos `NAV_GROUPS`).

**Bottom nav (mobile):**

| Papel | Itens na barra |
|-------|----------------|
| EMPLOYEE | Início, Agenda, Campo (+ Mais se houver extras) |
| SUPERVISOR / MANAGER / ADMIN / PLATFORM_ADMIN | Início, Agenda, Mapa, Rotas + Mais |

Itens restantes (Serviços, Clientes, etc.) ficam no sheet **Mais**.

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A no chrome.

### 6. Ações

Navegar · Alterar senha · Sair · tema no menu da conta.

### 7. Estados

loading sessão (skeleton header + main) | idle | sem sessão (redirect api-client).

### 8. Permissões

Middleware só cookie. Item some da nav se `roles` não inclui o papel. API 403 se URL direta.

### 9. Navegação

Campo `/field/navigate` e `/field/visits/[id]` usam layout `(field-nav)` sem este chrome.

### 10. Mobile / PWA

- **&lt;768px:** bottom nav + Mais (bottom sheet); sidebar **não** abre drawer.
- Safe areas: header (`safe-pt`), bottom nav (`--safe-bottom`), sheets.
- Conteúdo com `app-main-pad` reserva altura da bottom nav.
- Touch: `.ops-btn` / `.ops-input` / itens de menu ≥ ~44px.
- Listagens CRUD: cards no mobile via `DataTable`.
- PWA: `manifest` `display: standalone`, `start_url: "/"`, `viewportFit: cover`.
- Página sem zoom (pinch); zoom de câmera só no MapLibre.

### 11. Fora de escopo

Top-nav horizontal desktop. Motion Icons. Blocos premium ReUI.

### 12. Como testar

1. ADMIN mobile: bottom nav Início/Agenda/Mapa/Rotas; Mais → Serviços/Clientes/…
2. EMPLOYEE mobile: Início, Agenda, Campo.
3. Desktop md+: sidebar com três grupos; sem bottom nav.
4. `/` e `/map` full-bleed; conteúdo não sob a bottom nav.
5. Tema claro/escuro: header e bottom nav legíveis.
6. Conta no header: menu Alterar senha / tema / Sair.
7. `/field/navigate`: sem sidebar nem bottom nav.

---

Nota: substitui o modelo “hamburger → sidebar sheet” do chrome mobile (pré mobile-first PWA).
