import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/_next',
  '/icons',
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.ico',
  // Proxy Next → Nest (same-origin no celular). Auth fica na API, não no middleware.
  '/api',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const hasAccess = Boolean(request.cookies.get('access_token')?.value);
  const hasRefresh = Boolean(request.cookies.get('refresh_token')?.value);
  const hasSession = hasAccess || hasRefresh;

  // Rotas protegidas: precisa de algum cookie
  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Só redireciona longe do login se houver access_token.
  // Cookie refresh órfão (ex.: após wipe do banco) NÃO deve bloquear a tela de login
  // (senão: / ↔ /login em loop infinito).
  if (hasAccess && (pathname === '/login' || pathname === '/forgot-password')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)'],
};
