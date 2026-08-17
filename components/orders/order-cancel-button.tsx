'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function OrderCancelButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!confirm('Annuler cette commande ?')) return;
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', reason: 'Annulation client' }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(body.error ?? 'Annulation impossible');
      return;
    }
    toast.success('Commande annulée');
    router.refresh();
  }

  return (
    <Button variant="outline" className="w-full" disabled={busy} onClick={cancel}>
      Annuler la commande
    </Button>
  );
}
