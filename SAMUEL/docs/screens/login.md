# PRD UX/Funcional v0.9 — Login

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §2.1.

## Tela: Login

### 1. Identidade

- Rota: `/login`
- Papéis: público; autenticado com `access_token` → redirect `/`
- Objetivo: autenticar e entrar no shell
- Arquivos: `apps/web/src/app/(auth)/login/page.tsx`, `LoginForm.tsx`, `AuthCard.tsx`

### 2. Componentes

```
AuthCard (marca Rotas, H1 Entrar, subtítulo, rodapé)
└── LoginForm
    ├── banner ?changed=1
    ├── input E-mail
    ├── PasswordField Senha
    ├── FormError
    ├── SubmitButton Entrar
    └── Link Esqueci minha senha
```

### 3. Informação

| Campo | Tipo | Validação | Erro |
| --- | --- | --- | --- |
| E-mail | email | required + formato | “Informe um e-mail válido.” |
| Senha | password | min 8 | “A senha deve ter pelo menos 8 caracteres.” |

Banner: “Senha alterada. Entre novamente.” quando `?changed=1`.

### 4. KPI / totais

N/A — formulário de autenticação.

### 5. Filtros e busca

N/A.

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Entrar | `POST /api/v1/auth/login` → `safeNextPath(?next)` (default `/`) |
| Esqueci minha senha | `/forgot-password` |

### 7. Estados

| Estado | UI |
| --- | --- |
| idle | form editável |
| loading | campos disabled; botão loading |
| invalid | erros de campo `role=alert` |
| error 401 | “E-mail ou senha inválidos.” |
| error 403 | mensagem inativo/suspenso |
| error 429 | “Muitas tentativas…” |
| error rede | “Falha de rede…” |
| success | redirect |
| empty / forbidden | N/A |

### 8. Permissões

Público. Middleware redireciona quem já tem `access_token` para `/`.

### 9. Navegação

- De: middleware (`?next=`), change-password (`?changed=1`), logout
- Para: `/` ou path relativo seguro em `?next=`
- Query: `next`, `changed`

### 10. Mobile / PWA

AuthCard centralizado; card ~max 400px. Depois do login, o campo (`/field/*`) só segue no PWA instalado.

### 11. Fora de escopo desta tela

MFA, SSO, lembrar-me, cadastro self-service.

### 12. Como testar

1. Seed → home.
2. Senha errada → erro genérico 401.
3. User SUSPENDED → 403.
4. Já logado em `/login` → `/`.
5. Viewport ~375px.
