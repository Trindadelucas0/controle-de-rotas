# Tema 13 — Evidências (fotos)

**Status:** done (MVP local storage, integrado em `/field/visits/[id]`)

**Pré-requisito:** visita em atendimento (`IN_PROGRESS` após check-in).

## Entregue

- Upload de foto(s) vinculadas à visita (1–5, JPEG/PNG/WebP, 5 MB)
- Metadados no Postgres (`visit_evidence`); binário em `STORAGE_DIR` (disco local)
- Download autenticado via `GET .../evidence/:id/file` (sem URL pública)
- ACL: mesma empresa; EMPLOYEE só nas próprias visitas
- Listagem no detalhe da visita e no relatório da OS (`/services/[id]`)

## Telas

| Rota | Papéis | Objetivo |
| --- | --- | --- |
| `/field/visits/[id]` | EMPLOYEE | Capturar/enviar foto na mesma tela do relatório |

## APIs

| Método | Path | Notas |
| --- | --- | --- |
| `POST` | `/api/v1/visits/:id/evidence` | multipart `file`; magic bytes |
| `GET` | `/api/v1/visits/:id/evidence` | metadados |
| `GET` | `/api/v1/visits/:id/evidence/:evidenceId/file` | stream autenticado |

## Fora de escopo

- S3/MinIO (interface preparada via `LocalStorageService`)
- OCR, watermark, PDF
- DELETE de evidência (fase 2)

## Critérios de aceite

- [x] Validação MIME/tamanho no servidor
- [x] Sem acesso cross-tenant (IDOR)
- [x] `STORAGE_DIR` em `.env.example`
- [x] Docs + testes e2e

## Como validar

1. Check-in → upload foto → listar → img no gestor.
2. HTML disfarçado → 422.
3. Outro tenant → 404 no arquivo.
