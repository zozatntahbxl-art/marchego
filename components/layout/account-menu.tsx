'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function AccountMenu({
  user,
}: {
  user: { roles: string[]; profile: { firstName: string; lastName: string } | null } | null;
}) {
  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/auth/connexion">Connexion</Link>
      </Button>
    );
  }

  const initials = `${user.profile?.firstName?.[0] ?? ''}${user.profile?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <Link
      href="/compte"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
      aria-label="Mon compte"
    >
      {initials || '•'}
    </Link>
  );
}
