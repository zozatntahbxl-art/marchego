'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const KEY = 'mg_cookie_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!localStorage.getItem(KEY));
  }, []);

  if (!visible) return null;

  function save(granted: boolean) {
    localStorage.setItem(KEY, granted ? 'granted' : 'denied');
    setVisible(false);
    fetch('/api/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'cookies', granted }),
    }).catch(() => {});
  }

  return (
    <div
      role="dialog"
      aria-label="Consentement cookies"
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 p-4"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border bg-card p-4 shadow-lifted sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          Nous utilisons des cookies essentiels au fonctionnement et, avec votre accord, des
          cookies d’analyse (PostHog). Consultez notre{' '}
          <Link href="/legal/confidentialite" className="underline">
            politique de confidentialité
          </Link>
          .
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => save(false)}>
            Refuser
          </Button>
          <Button size="sm" onClick={() => save(true)}>
            Accepter
          </Button>
        </div>
      </div>
    </div>
  );
}
