# PRD UX/Funcional v0.9 — Esqueci a senha

Documento consolidado: [`docs/PRD-UX-FUNCIONAL.md`](../PRD-UX-FUNCIONAL.md) §2.2.

## Tela: Esqueci a senha

### 1. Identidade

- Rota: `/forgot-password`
- Papéis: público
- Objetivo: solicitar reset sem vazar existência do e-mail
- Arquivos: `apps/web/src/app/(auth)/forgot-password/page.tsx`, `ForgotPasswordForm.tsx`

### 2. Componentes

```
AuthCard
└── ForgotPasswordForm
    ├── input E-mail | FormError | SubmitButton Enviar link | Link Voltar
    └── (success) alerta verde + Voltar ao login
```

### 3. Informação

| Campo | Tipo | Validação | Erro |
| --- | --- | --- | --- |
| E-mail | email | required + formato | “Informe um e-mail válido.” |

Sucesso: mensagem genérica da API (`data.message`), mesma UX se e-mail existir ou não.

### 4. KPI / totais

N/A.

### 5. Filtros e busca

N/A.

### 6. Ações

| Ação | Efeito |
| --- | --- |
| Enviar link | `POST /api/v1/auth/forgot-password` |
| Voltar ao login | `/login` |

### 7. Estados

| Estado | UI |
| --- | --- |
| idle / loading | form / disabled |
| invalid | erro de campo |
| error / 429 | FormError |
| success | alerta verde `role=status` |
| empty / forbidden | N/A |

### 8. Permissões

Público. Com `access_token`, middleware redireciona `/login` e `/forgot-password` para `/`.

### 9. Navegação

- De: link no login
- Para: `/login` (manual); token de reset só no **log da API** em dev (sem SMTP)
- Query: N/A nesta tela

### 10. Mobile / PWA

Card central mobile-first.

### 11. Fora de escopo desta tela

Envio real de e-mail; revelar se o e-mail existe.

### 12. Como testar

1. E-mail existente → success + URL no log da API.
2. E-mail inexistente → mesma UI de sucesso.
3. Rate limit → 429.
