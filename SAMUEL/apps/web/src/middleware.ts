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

/** Hosts que o túnel/proxy pode mandar em x-forwarded-host (anti host-header injection). */
function allowedForwardedHost(host: string): boolean {
  const h = host.toLowerCase().split(':')[0];
  if (h === 'rotas.avadesk.com.br') return true;
  if (h === 'localhost') return true;
  if (h === '127.0.0.1') return true;
  return false;
}

function redirectUrl(request: NextRequest, pathname: string, search = ''): URL {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const hostOnly = forwardedHost?.split(':')[0];
  if (hostOnly && allowedForwardedHost(hostOnly)) {
    url.hostname = hostOnly;
  }
  if (forwardedProto === 'https') {
    url.protocol = 'https:';
    url.port = '';
  } else if (forwardedProto === 'http') {
    url.protocol = 'http:';
  }
  return url;
}

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
    const url = redirectUrl(request, '/login');
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Só redireciona longe do login se houver access_token.
  // Cookie refresh órfão (ex.: após wipe do banco) NÃO deve bloquear a tela de login
  // (senão: / ↔ /login em loop infinito).
  if (hasAccess && (pathname === '/login' || pathname === '/forgot-password')) {
    return NextResponse.redirect(redirectUrl(request, '/', ''));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)'],
};
