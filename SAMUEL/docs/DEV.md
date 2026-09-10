# Como subir (dev)

## Pré-requisitos

- Node ≥ 20
- **Docker Desktop ligado** (Postgres/PostGIS + Redis)

## Portas fixas

| Serviço | Porta |
| --- | --- |
| Web (Next) | **3000** |
| API (Nest) | **3001** |
| PostGIS | **5433** |
| Redis | **6379** |

**Importante:** `apps/web/.env.local` só com `NEXT_PUBLIC_*` (sem `PORT`).

**Dev origins:** `next.config.js` inclui `localhost`, `127.0.0.1`, `[::1]` e IPs da LAN em `allowedDevOrigins`. Sem isso o Next 15 bloqueia `/_next/*` e o browser mostra “Application error: a client-side exception…”.

**Mapa (CARTO Voyager):** defina `NEXT_PUBLIC_CARTO_BASEMAPS_KEY` em `apps/web/.env.local` (chave do e-mail CARTO Basemaps). Sem ela o mapa carrega com watermark “API KEY REQUIRED”. Depois de gravar a env, **reinicie** `npm run dev` e faça hard refresh (CDN/browser cacheiam tiles antigos).

## Um comando

```bash
npm run dev
```

Sobe Docker (`--wait`), espera 5433/6379, API + Web.

No terminal o Next imprime algo assim:

```text
- Local:   http://localhost:3000
- Network: http://192.168.x.x:3000
```

### Celular na mesma Wi‑Fi

1. No PC: `npm run dev` (web escuta `0.0.0.0:3000`).
2. No telefone abra o **Network** (`http://SEU_IP:3000`), **não** `localhost`.
3. Login e preview de rotas usam `/api/v1` no **mesmo host** (rewrite Next `beforeFiles` → Nest). Não precisa abrir a porta 3001 no firewall do PC.
4. `NEXT_PUBLIC_API_URL` vazio em `apps/web/.env.local` (same-origin). Se apontar para `http://localhost:3001`, o celular quebra o login.
5. O middleware **não** pode proteger `/api` — senão o POST de login vira redirect HTML para `/login` e o celular “não entra”.
6. **GPS / navegação (`/field/*`):** em `http://192.168…` o campo **abre** com a faixa **NÃO ESTÁ EM HTTPS**; o GPS do celular continua bloqueado pelo navegador. Para GPS de verdade: **HTTPS** (túnel) + app instalado + **Permitir** no iOS/Android. No PC, `http://localhost:3000` não exige instalar e o GPS pode funcionar.

- Web: http://localhost:3000
- Mapa: http://localhost:3000/map
- Rotas: http://localhost:3000/routes (requer pin da empresa)
- Health: http://localhost:3001/api/v1/health (`postgis: true` após migrate)
- Seed: `admin@demo.local` / `ChangeMe123!`

`OSRM_URL` na API (default `https://router.project-osrm.org`) calcula traçado nas ruas; se falhar, o preview usa linha reta.

`APP_TIMEZONE` (default `America/Sao_Paulo`) define o “dia operacional” de rotas e de `GET /field/my-route` quando `date` não é enviado.

**Fotos de visita:** `STORAGE_DIR` no `.env` da API (default `apps/api/storage`). Reinicie a API após alterar.

## Testes da API

Postgres Docker na 5433 precisa estar no ar. O harness usa o banco **`samuel_test`** (não o `samuel` do `npm run dev`):

```bash
npm run test -w apps/api
```

`TEST_DATABASE_URL` está no `.env.example`. Os testes criam a database se faltar e rodam `prisma migrate deploy` nela.

## PostGIS (Tema 06)

Imagem: `postgis/postgis:16-3.5` (não use o instalador Windows no `DATABASE_URL` do Rotas).

**Sempre rode os comandos na raiz do projeto:** `C:\Users\trind\Desktop\SAMUEL`  
(não em `SAMUEL\apps` nem em `Desktop`).

```powershell
cd C:\Users\trind\Desktop\SAMUEL

docker compose pull
docker compose up -d --wait

# Se o container postgres falhar (volume antigo incompatível):
docker compose down
docker volume rm samuel_samuel_pg
docker compose up -d --wait

cd apps\api
npx prisma migrate deploy
npx tsx prisma/seed.ts
cd ..\..

npm run dev
```

## Primeira vez (projeto)

```bash
cp .env.example .env
cp .env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm install
npm run docker:up
npm run db:migrate
npm run db:seed
```

## Servidor fecha sozinho / porta ocupada

1. O `concurrently` **não** usa mais `-k`: se o Web cair, a API continua (e vice-versa), com até 3 reinícios automáticos.
2. Se a porta 3000 ou 3001 estiver ocupada por um processo órfão, o Next/Nest falha e o terminal parece “fechar” o servidor. Liberar:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
```

3. Depois, na raiz: `npm run dev` e **deixe esse terminal aberto** (não rode outro `npm run dev` em paralelo).
4. O Cursor às vezes encerra processos iniciados pelo agente; prefira subir o `npm run dev` no **seu** terminal integrado.

## Produção VPS (analise)

Não usa as portas de dev (3000/3001). Build + Docker + PM2 em `/opt/analise/SAMUEL`.

**Atualizar o que já está no ar:** colar o bloco **inteiro** de [`vps-atualizar.txt`](vps-atualizar.txt) no SSH (`set -e` no começo). Copia `.env` para `/root/analise-pre-update-*`, descarta edições locais da VPS (`git reset --hard` + `git clean -fd`) e alinha com `origin/main`. Sem isso o `git pull` aborta e o npm/prisma podem rodar no código antigo. Não rode seed. `.env` ignorado permanece.

Primeira subida:

| Serviço | Endereço |
| --- | --- |
| Web (cadastrar no Cloudflare) | `http://127.0.0.1:3468` |
| API | `http://127.0.0.1:3469` |
| PostGIS | `127.0.0.1:5434` |
| Redis | `127.0.0.1:6381` |

```bash
cd /opt/analise/SAMUEL
docker compose -f docker-compose.prod.yml up -d --wait
# .env só no servidor (JWT e senha do banco gerados lá; não commitar)
npm ci
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
# seed uma vez
cd apps/api && npx tsx prisma/seed.ts && cd ../..
API_PROXY_TARGET=http://127.0.0.1:3469 npm run web:build
npm run api:build
pm2 start ecosystem.config.cjs
pm2 save
```

Público: `https://rotas.avadesk.com.br` (túnel → `http://localhost:3468`). Login seed: `admin@demo.local` / `ChangeMe123!`. `COOKIE_SECURE=true`; `CORS_ORIGIN` no servidor aponta para esse hostname.

Mapa: `NEXT_PUBLIC_CARTO_BASEMAPS_KEY` em `apps/web/.env.local` **no servidor**, depois `API_PROXY_TARGET=http://127.0.0.1:3469 npm run web:build` e `pm2 restart analise-web`. Sem a chave no build, as tiles CARTO mostram “API KEY REQUIRED”.

Túnel: o Cloudflare manda `Host: localhost:3468`. O middleware lê `x-forwarded-host` para redirects HTTPS em `rotas.avadesk.com.br` (não `https://localhost:3468/login`).
