'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCents } from '@/lib/utils';

interface ProductRow {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
  isAvailable: boolean;
  category: { nameFr: string };
}

export function VendorProductManager({
  products,
  categories,
}: {
  products: ProductRow[];
  categories: { id: string; nameFr: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/vendors/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fd.get('name'),
        categoryId: fd.get('categoryId'),
        priceCents: Math.round(Number(fd.get('price')) * 100),
        unit: fd.get('unit'),
        stock: Number(fd.get('stock') || 0),
        origin: fd.get('origin') || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Création impossible.');
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="name">Nouveau produit</Label>
          <Input id="name" name="name" required minLength={2} />
        </div>
        <div>
          <Label htmlFor="categoryId">Catégorie</Label>
          <select
            id="categoryId"
            name="categoryId"
            required
            className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameFr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="price">Prix TTC (€)</Label>
          <Input id="price" name="price" type="number" step="0.01" min="0.10" required />
        </div>
        <div>
          <Label htmlFor="unit">Unité</Label>
          <select
            id="unit"
            name="unit"
            className="flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
            defaultValue="PIECE"
          >
            {['PIECE', 'KG', 'BOTTE', 'BARQUETTE', 'PAQUET'].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="stock">Stock</Label>
          <Input id="stock" name="stock" type="number" min={0} defaultValue={10} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="origin">Origine</Label>
          <Input id="origin" name="origin" placeholder="Hesbaye, Wépion…" />
        </div>
        {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
        <Button type="submit" className="md:col-span-2">
          Ajouter
        </Button>
      </form>

      <ul className="space-y-2">
        {products.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.category.nameFr} · stock {p.stock}
              </p>
            </div>
            <p className="font-semibold">{formatCents(p.priceCents)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
