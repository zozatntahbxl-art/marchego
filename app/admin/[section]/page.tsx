import { notFound } from 'next/navigation';
import { AdminConsole } from '@/components/admin/admin-console';
import { ADMIN_SECTIONS } from '@/lib/admin/sections';

export const dynamic = 'force-dynamic';

export default function AdminSectionPage({ params }: { params: { section: string } }) {
  if (!ADMIN_SECTIONS.includes(params.section as never) || params.section === 'dashboard') {
    notFound();
  }
  return <AdminConsole section={params.section} />;
}
