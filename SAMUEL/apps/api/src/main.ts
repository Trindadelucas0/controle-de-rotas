import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import os from 'os';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isDevLanWebOrigin(origin: string): boolean {
  return /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):3000$/.test(
    origin,
  );
}

function lanIpv4s(): string[] {
  const out: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const infos of Object.values(ifaces)) {
    for (const info of infos || []) {
      if (info.family === 'IPv4' && !info.internal) out.push(info.address);
    }
  }
  return out;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Geometria OSRM (LineString) no POST /routes pode passar de 100kb
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const allowed = parseCorsOrigins(process.env.CORS_ORIGIN || 'http://localhost:3000');
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // same-origin / tools sem Origin
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.includes('*') || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      // Dev: celular/PC na LAN acessando a web na :3000
      if (process.env.NODE_ENV !== 'production' && isDevLanWebOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  const port = Number(process.env.PORT || 3001);
  const host = process.env.LISTEN_HOST?.trim() || '0.0.0.0';
  await app.init();
  // Se o Express cair num 404 cru (HTML "Cannot POST"), devolve o JSON do projeto.
  app.getHttpAdapter().getInstance().use((_req: Request, res: Response) => {
    if (res.headersSent) return;
    res.status(404).json({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado.',
    });
  });
  await app.listen(port, host);
  console.log(`Rotas API listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/api/v1`);
  if (host === '0.0.0.0') {
    for (const ip of lanIpv4s()) {
      console.log(`Rotas API Network http://${ip}:${port}/api/v1`);
    }
  }
}

bootstrap();
