import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AdminNav, AdminMobileNav } from '@/components/admin/admin-nav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.roles.includes('ADMIN')) redirect('/auth/connexion?next=/admin');

  return (
    <div className="flex min-h-dvh bg-background">
      <AdminNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav />
        {children}
      </div>
    </div>
  );
}
