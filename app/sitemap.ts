import type { MetadataRoute } from 'next';
import { BELGIAN_MARKETS } from '@/lib/data/belgian-markets';
import { clientEnv } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const staticPages: MetadataRoute.Sitemap = [
    '',
    '/marches',
    '/vendeur/onboarding',
    '/livreur/onboarding',
    '/legal/cgu',
    '/legal/confidentialite',
    '/legal/mentions',
  ].map((path) => ({
    url: `${base}${path || '/'}`,
    changeFrequency: path === '' || path === '/marches' ? 'daily' : 'monthly',
    priority: path === '' ? 1 : path === '/marches' ? 0.9 : 0.5,
  }));

  const markets: MetadataRoute.Sitemap = BELGIAN_MARKETS.map((m) => ({
    url: `${base}/marches/${m.slug}`,
    changeFrequency: 'weekly',
    priority: m.featured ? 0.8 : 0.6,
  }));

  return [...staticPages, ...markets];
}
