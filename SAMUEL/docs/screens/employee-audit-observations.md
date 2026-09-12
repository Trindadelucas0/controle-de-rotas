# Tela: Observações de auditoria (perfil do funcionário)

- Rota: `/employees/[id]` (seção no detalhe; não é rota nova)
- Papéis que acessam: ADMIN, MANAGER
- Objetivo: dossiê para investigar km e desvio de rota sem mostrar nada no celular do funcionário
- Layout (blocos): lista de cards (código, data, resumo, km/combustível, fotos, links rota/mapa, Marcar como vista)
- Campos: só leitura; status OPEN/SEEN
- Ações / botões: Marcar como vista; Foto início/fim; Ver rotas; Ver no mapa
- Estados: loading skeleton | success data | empty “Nenhuma observação de auditoria.” | error
- Chamadas de API: `GET /ops/employees/:id/observations`; `PATCH .../observations/:oid`; `GET /routes/:id/evidence/:eid/file`
- Redirects: N/A
- Mobile / PWA: lista empilhada
- Acessibilidade: botões com texto; erros `role=alert`
- Fora de escopo desta tela: OCR do odômetro; UI global `/settings/audit`
- Como testar:
  1. Campo conclui rota com km bem acima do planejado
  2. Login ADMIN → Funcionários → o perfil mostra o caso com fotos e números
  3. Login EMPLOYEE não tem menu Funcionários; `GET` observações → 403
