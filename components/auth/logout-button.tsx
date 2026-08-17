'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await fetch('/api/auth', { method: 'DELETE' });
        router.push('/');
        router.refresh();
      }}
    >
      Déconnexion
    </Button>
  );
}
