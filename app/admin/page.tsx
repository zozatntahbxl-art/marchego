import { AdminConsole } from '@/components/admin/admin-console';

export const dynamic = 'force-dynamic';

export default function AdminHomePage() {
  return <AdminConsole section="dashboard" />;
}
