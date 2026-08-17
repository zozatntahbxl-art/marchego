import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const locale = req.cookies.get('mg_locale')?.value ?? 'fr';
  res.headers.set('x-marchego-locale', locale);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)'],
};
