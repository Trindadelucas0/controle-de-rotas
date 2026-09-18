# PRD UX/Funcional v0.9 — Chrome (shell)

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §1.

## Tela: Chrome compartilhado (não é rota)

### 1. Identidade

- Rotas cobertas: autenticadas **exceto** `/field/navigate` e `/field/visits/[id]`
- Papéis: conforme item da sidebar
- Objetivo: navegação Operação · Recursos · Administração + sessão
- Arquivos: `(app)/layout.tsx`, `AppHeader.tsx`, `AppSidebar.tsx`, `AppNav.tsx`, `UserMenu.tsx`

### 2. Componentes

```
SidebarProvider
├── AppSidebar (c-sidebar-1): Rotas + empresa + grupos Lucide
└── SidebarInset
    ├── AppHeader: SidebarTrigger (md-) | UserMenu dropdown
    └── conteúdo: full-bleed em `/` e `/map`; senão max-w-5xl
```

Chrome (header, sidebar, sheet) usa `--surface` / `--sidebar` e segue `data-theme` (e classe `.dark` no `html`). Texto e botões ficam visíveis nos dois temas. Campo tela cheia (`field-nav`) permanece HUD escuro, **sem** `SidebarProvider`.

### 3. Informação

Grupos: **Operação** (Início, Mapa, Agenda, Serviços, Rotas, Campo) · **Recursos** (Clientes, Funcionários, Veículos, Abastecimentos, Custos) · **Administração** (Empresas PLATFORM_ADMIN, Empresa, Usuários). Custos/Abastecimentos: ADMIN, MANAGER, SUPERVISOR (não EMPLOYEE). Labels e papéis: ver PRD UX §1. Ícones em `app-icons.ts`.

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A.

### 6. Ações

Navegar · Alterar senha → `/account/change-password` · Sair → logout + `/login` · tema no menu da conta.

### 7. Estados

loading sessão (skeleton header + main) | idle | sem sessão (redirect api-client).

### 8. Permissões

Middleware só cookie. Item some da nav se `roles` não inclui o papel (`roleAllowed` / `NAV_GROUPS`). API 403 se URL direta.

### 9. Navegação

Campo `/field/navigate` e `/field/visits/[id]` usam layout `(field-nav)` sem este chrome.

### 10. Mobile / PWA

`SidebarTrigger` `aria-label="Abrir menu"` (visível abaixo de `md`). Sheet fecha ao navegar.

Página sem zoom (pinch / duplo toque / teclado). Zoom de câmera só no canvas MapLibre das telas de mapa.

### 11. Fora de escopo

Top-nav horizontal. Motion Icons. Blocos premium ReUI.

### 12. Como testar

1. ADMIN: três grupos visíveis.
2. EMPLOYEE: Início, Agenda, Campo; sem Clientes/Mapa/Serviços/Rotas/Empresa.
3. SUPERVISOR: Mapa/Agenda/Serviços/Rotas/Clientes; sem Funcionários/Veículos/Admin.
4. `/` e `/map` sem padding `max-w-5xl`.
5. Tema **Claro**: header mostra nome no dropdown; sidebar mostra **Rotas**; trigger no mobile. Voltar a **Escuro** mantém contraste.
6. Navegar em `/field/navigate`: sem sidebar.

---

Nota histórica: esta ficha substitui o “home legado” (atalhos pré-v0.10.0). Home atual: [home.md](home.md).
