import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { CookieBanner } from '@/components/legal/cookie-banner';
import { clientEnv } from '@/lib/env';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: 'MarchéGo — Les marchés belges, livrés chez vous',
    template: '%s · MarchéGo',
  },
  description:
    'Commandez vos courses au marché du dimanche et faites-vous livrer à domicile. Fruits, fromages, boulangerie — partout en Belgique.',
  applicationName: 'MarchéGo',
  authors: [{ name: 'M. El Tawfik' }, { name: 'Billy .M' }],
  creator: 'Billy .M',
  publisher: 'MarchéGo',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MarchéGo',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'fr_BE',
    siteName: 'MarchéGo',
    title: 'MarchéGo — Les marchés belges, livrés chez vous',
    description: 'La place de marché de livraison des étals belges.',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7ec' },
    { media: '(prefers-color-scheme: dark)', color: '#121c16' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-background font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <QueryProvider>
            {children}
            <CookieBanner />
            <Toaster richColors position="top-center" offset="max(12px, env(safe-area-inset-top))" />
          </QueryProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`,
          }}
        />
      </body>
    </html>
  );
}
