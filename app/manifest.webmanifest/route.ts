import { NextResponse } from 'next/server';

export function GET() {
  const body = {
    name: 'MarchéGo',
    short_name: 'MarchéGo',
    description: 'Les marchés belges, livrés chez vous',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7ec',
    theme_color: '#3d7c2c',
    lang: 'fr-BE',
    icons: [
      { src: '/icon', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
  return NextResponse.json(body, {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
