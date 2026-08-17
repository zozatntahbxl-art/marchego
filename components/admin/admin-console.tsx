'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { formatCents } from '@/lib/utils';
import { ADMIN_SECTIONS } from '@/lib/admin/sections';

type Json = Record<string, unknown>;

async function apiGet(resource: string, q = '', page = 1) {
  const url = `/api/admin/manage?resource=${encodeURIComponent(resource)}&q=${encodeURIComponent(q)}&page=${page}&limit=40`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Erreur');
  return body;
}

async function apiPost(resource: string, action: string, id?: string, data?: Json) {
  const res = await fetch('/api/admin/manage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource, action, id, data }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Action impossible');
  return body;
}

export function AdminConsole({ section }: { section: string }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Json | null>(null);

  const valid = ADMIN_SECTIONS.includes(section as never);

  async function reload() {
    setLoading(true);
    try {
      setData(await apiGet(section, q));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!valid) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  if (!valid) {
    return <p className="p-6 text-sm text-muted-foreground">Section inconnue.</p>;
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps mb-1">Administration</p>
          <h1 className="section-title capitalize">{label(section)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pilotage complet de la plateforme</p>
        </div>
        {section !== 'dashboard' && section !== 'settings' && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void reload();
            }}
          >
            <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit">Filtrer</Button>
          </form>
        )}
      </div>
      {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!loading && data && <SectionView section={section} data={data} onDone={reload} />}
    </div>
  );
}

function label(section: string) {
  const map: Record<string, string> = {
    dashboard: 'Tableau de bord',
    users: 'Utilisateurs',
    vendors: 'Vendeurs',
    couriers: 'Livreurs',
    markets: 'Marchés',
    products: 'Produits',
    categories: 'Catégories',
    orders: 'Commandes',
    disputes: 'Litiges',
    reviews: 'Avis',
    payouts: 'Versements',
    holidays: 'Jours fériés',
    notifications: 'Notifications',
    settings: 'Réglages financiers',
    audit: 'Journal d’audit',
  };
  return map[section] ?? section;
}

function SectionView({
  section,
  data,
  onDone,
}: {
  section: string;
  data: Json;
  onDone: () => void;
}) {
  if (section === 'dashboard') return <Dashboard data={data} />;
  if (section === 'settings') return <SettingsForm item={(data.items as Json[])?.[0]} onDone={onDone} />;
  if (section === 'markets') return <MarketsPanel items={(data.items as Json[]) ?? []} onDone={onDone} />;
  if (section === 'categories') return <CategoriesPanel items={(data.items as Json[]) ?? []} onDone={onDone} />;
  if (section === 'holidays') return <HolidaysPanel items={(data.items as Json[]) ?? []} onDone={onDone} />;

  const items = (data.items as Json[]) ?? [];
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            {headers(section).map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={String(row.id)} className="border-b last:border-0">
              {rowCells(section, row).map((cell, i) => (
                <td key={i} className="px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
              <td className="px-4 py-3">
                <RowActions section={section} row={row} onDone={onDone} />
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-muted-foreground" colSpan={8}>
                Aucun élément.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function headers(section: string) {
  switch (section) {
    case 'users':
      return ['E-mail', 'Rôles', 'Statut', 'Créé'];
    case 'vendors':
      return ['Boutique', 'TVA', 'Vérif.', 'Note', 'Produits'];
    case 'couriers':
      return ['Livreur', 'Véhicule', 'En ligne', 'Rayon', 'Vérif.'];
    case 'products':
      return ['Produit', 'Vendeur', 'Prix', 'Stock', 'Statut'];
    case 'orders':
      return ['Réf.', 'Marché', 'Total', 'Paiement', 'Statut'];
    case 'disputes':
      return ['Commande', 'Motif', 'Statut', 'Ouvert par'];
    case 'reviews':
      return ['Cible', 'Note', 'Commentaire', 'Auteur'];
    case 'payouts':
      return ['Bénéficiaire', 'Montant', 'Statut', 'Période'];
    case 'notifications':
      return ['Destinataire', 'Type', 'Titre', 'Date'];
    case 'audit':
      return ['Action', 'Cible', 'Admin', 'Date'];
    default:
      return ['Id'];
  }
}

function rowCells(section: string, row: Json): React.ReactNode[] {
  switch (section) {
    case 'users':
      return [
        String(row.email),
        ((row.roles as string[]) ?? []).join(', '),
        <Badge key="s">{String(row.status)}</Badge>,
        fmtDate(row.createdAt),
      ];
    case 'vendors':
      return [
        String(row.businessName),
        String(row.vatNumber),
        String(row.verificationStatus),
        Number(row.rating).toFixed(1),
        String((row._count as Json)?.products ?? '—'),
      ];
    case 'couriers': {
      const user = row.user as Json | undefined;
      const profile = user?.profile as Json | undefined;
      return [
        `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || String(user?.email ?? ''),
        String(row.vehicleType),
        row.online ? 'Oui' : 'Non',
        `${row.radiusKm} km`,
        String(row.verificationStatus),
      ];
    }
    case 'products':
      return [
        String(row.name),
        String((row.vendor as Json)?.businessName ?? ''),
        formatCents(Number(row.priceCents)),
        String(row.stock),
        `${row.isApproved ? 'Approuvé' : 'En attente'} · ${row.isAvailable ? 'actif' : 'off'}`,
      ];
    case 'orders':
      return [
        String(row.reference),
        String((row.market as Json)?.name ?? ''),
        formatCents(Number(row.totalCents)),
        String(row.paymentStatus),
        String(row.status),
      ];
    case 'disputes':
      return [
        String((row.order as Json)?.reference ?? ''),
        String(row.reason),
        String(row.status),
        String((row.openedBy as Json)?.email ?? ''),
      ];
    case 'reviews':
      return [String(row.targetRole), `${row.rating}/5`, String(row.comment ?? '—'), String((row.author as Json)?.email ?? '')];
    case 'payouts':
      return [String(row.beneficiary), formatCents(Number(row.amountCents)), String(row.status), fmtDate(row.periodStart)];
    case 'notifications':
      return [String((row.user as Json)?.email ?? ''), String(row.type), String(row.title), fmtDate(row.createdAt)];
    case 'audit':
      return [String(row.action), `${row.targetType} ${row.targetId ?? ''}`, String((row.admin as Json)?.email ?? '—'), fmtDate(row.createdAt)];
    default:
      return [String(row.id)];
  }
}

function RowActions({ section, row, onDone }: { section: string; row: Json; onDone: () => void }) {
  async function run(action: string, data?: Json) {
    try {
      await apiPost(section, action, String(row.id), data);
      toast.success('Enregistré');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }

  if (section === 'users') {
    return (
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={() => run(row.status === 'SUSPENDU' ? 'activate' : 'suspend')}>
          {row.status === 'SUSPENDU' ? 'Activer' : 'Suspendre'}
        </Button>
      </div>
    );
  }
  if (section === 'vendors' || section === 'couriers') {
    return (
      <div className="flex flex-wrap gap-1">
        <Button size="sm" onClick={() => run('verify', { decision: 'APPROUVE' })}>
          Valider
        </Button>
        <Button size="sm" variant="destructive" onClick={() => run('verify', { decision: 'REJETE' })}>
          Rejeter
        </Button>
      </div>
    );
  }
  if (section === 'products') {
    return (
      <div className="flex flex-wrap gap-1">
        <Button size="sm" onClick={() => run('approve')}>
          Approuver
        </Button>
        <Button size="sm" variant="outline" onClick={() => run('update', { isAvailable: !row.isAvailable })}>
          {row.isAvailable ? 'Masquer' : 'Publier'}
        </Button>
      </div>
    );
  }
  if (section === 'orders') {
    return (
      <div className="flex flex-wrap gap-1">
        <select
          className="h-9 rounded-full border px-2 text-xs"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) void run('status', { status: e.target.value });
          }}
        >
          <option value="">Forcer statut</option>
          {[
            'EN_ATTENTE',
            'ACCEPTEE_PAR_VENDEUR',
            'PREPAREE',
            'EN_ATTENTE_DE_LIVREUR',
            'LIVREUR_ASSIGNE',
            'EN_ROUTE_VERS_MARCHE',
            'EN_RECUPERATION',
            'EN_ROUTE_VERS_CLIENT',
            'LIVREE',
            'ANNULEE',
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => run('refund')}>
          Rembourser
        </Button>
        <Button size="sm" variant="destructive" onClick={() => run('cancel', { reason: 'Annulation admin' })}>
          Annuler
        </Button>
      </div>
    );
  }
  if (section === 'disputes') {
    return (
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={() => run('update', { status: 'EN_EXAMEN' })}>
          Examiner
        </Button>
        <Button size="sm" onClick={() => run('update', { status: 'RESOLU_REMBOURSEMENT', resolution: 'Remboursé par l’admin' })}>
          Résoudre + remboursement
        </Button>
        <Button size="sm" variant="ghost" onClick={() => run('update', { status: 'CLOS', resolution: 'Sans suite' })}>
          Clôturer
        </Button>
      </div>
    );
  }
  if (section === 'reviews') {
    return (
      <Button size="sm" variant="destructive" onClick={() => run('delete')}>
        Supprimer
      </Button>
    );
  }
  if (section === 'payouts') {
    return (
      <Button size="sm" onClick={() => run('markPaid')}>
        Marquer versé
      </Button>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

function Dashboard({ data }: { data: Json }) {
  const kpis = (data.kpis as Json) ?? {};
  const cards = [
    ['Commandes en cours', kpis.liveOrders],
    ['Vendeurs à valider', kpis.vendorsPending],
    ['Livreurs à valider', kpis.couriersPending],
    ['Litiges', kpis.openDisputes],
    ['Utilisateurs', kpis.users],
    ['Livreurs en ligne', kpis.couriersOnline],
    ['Marchés actifs', kpis.markets],
    ['GMV', formatCents(Number(kpis.gmvCents ?? 0))],
    ['GMV 7 j.', formatCents(Number(kpis.weekGmvCents ?? 0))],
    ['Commission', formatCents(Number(kpis.platformCents ?? 0))],
  ];
  const orders = (data.recentOrders as Json[]) ?? [];
  const audit = (data.recentAudit as Json[]) ?? [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{String(label)}</p>
            <p className="text-lg font-semibold">{String(value)}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Dernières commandes</h2>
          <ul className="space-y-2 text-sm">
            {orders.map((o) => (
              <li key={String(o.id)} className="flex justify-between gap-2">
                <span>
                  {String(o.reference)} · {(o.market as Json)?.name as string}
                </span>
                <span>{formatCents(Number(o.totalCents))}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-semibold">Journal récent</h2>
          <ul className="space-y-2 text-sm">
            {audit.map((a) => (
              <li key={String(a.id)}>
                <span className="font-medium">{String(a.action)}</span>{' '}
                <span className="text-muted-foreground">{fmtDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function MarketsPanel({ items, onDone }: { items: Json[]; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', city: 'Bruxelles', street: '', postalCode: '1000', latitude: '50.8467', longitude: '4.3525' });
  return (
    <div className="space-y-6">
      <form
        className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await apiPost('markets', 'create', undefined, {
              ...form,
              latitude: Number(form.latitude),
              longitude: Number(form.longitude),
            });
            toast.success('Marché créé');
            onDone();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erreur');
          }
        }}
      >
        <h2 className="font-semibold md:col-span-3">Nouveau marché</h2>
        {(['name', 'city', 'street', 'postalCode', 'latitude', 'longitude'] as const).map((key) => (
          <Input
            key={key}
            placeholder={key}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            required={key === 'name'}
          />
        ))}
        <Button type="submit" className="md:col-span-3">
          Créer le marché
        </Button>
      </form>
      <div className="space-y-3">
        {items.map((m) => (
          <article key={String(m.id)} className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{String(m.name)}</h3>
                <p className="text-sm text-muted-foreground">
                  {String(m.street)}, {String(m.postalCode)} {String(m.city)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {(['OUVERT', 'FERME', 'EN_PAUSE'] as const).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={m.status === status ? 'default' : 'outline'}
                    onClick={() =>
                      apiPost('markets', 'update', String(m.id), { status, statusLocked: true })
                        .then(() => {
                          toast.success('Statut mis à jour');
                          onDone();
                        })
                        .catch((e) => toast.error(e.message))
                    }
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {(m.schedules as Json[])?.length ?? 0} horaires · {(m.marketVendors as Json[])?.length ?? 0} étals ·{' '}
              {m.isActive ? 'actif' : 'inactif'}
            </p>
            <ScheduleForm marketId={String(m.id)} onDone={onDone} />
          </article>
        ))}
      </div>
    </div>
  );
}

function ScheduleForm({ marketId, onDone }: { marketId: string; onDone: () => void }) {
  const [dayOfWeek, setDay] = useState(0);
  const [startTime, setStart] = useState('08:00');
  const [endTime, setEnd] = useState('14:00');
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await apiPost('markets', 'addSchedule', marketId, { dayOfWeek, startTime, endTime });
          toast.success('Horaire ajouté');
          onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erreur');
        }
      }}
    >
      <select className="h-11 rounded-xl border px-2 text-sm" value={dayOfWeek} onChange={(e) => setDay(Number(e.target.value))}>
        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </select>
      <Input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} className="w-32" />
      <Input type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} className="w-32" />
      <Button size="sm" type="submit">
        Ajouter un horaire
      </Button>
    </form>
  );
}

function CategoriesPanel({ items, onDone }: { items: Json[]; onDone: () => void }) {
  const [nameFr, setName] = useState('');
  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await apiPost('categories', 'create', undefined, { nameFr });
          setName('');
          onDone();
        }}
      >
        <Input placeholder="Nouvelle catégorie" value={nameFr} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit">Ajouter</Button>
      </form>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={String(c.id)} className="flex items-center justify-between rounded-xl border bg-card p-3">
            <span>
              {String(c.icon)} {String(c.nameFr)}
            </span>
            <Button size="sm" variant="outline" onClick={() => apiPost('categories', 'update', String(c.id), { isActive: !c.isActive }).then(onDone)}>
              {c.isActive ? 'Désactiver' : 'Activer'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HolidaysPanel({ items, onDone }: { items: Json[]; onDone: () => void }) {
  const [date, setDate] = useState('');
  const [nameFr, setName] = useState('');
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await apiPost('holidays', 'create', undefined, { date, nameFr });
          onDone();
        }}
      >
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Input placeholder="Nom FR" value={nameFr} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit">Ajouter</Button>
      </form>
      <ul className="space-y-2 text-sm">
        {items.map((h) => (
          <li key={String(h.id)} className="rounded-xl border bg-card p-3">
            {fmtDate(h.date)} — {String(h.nameFr)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsForm({ item, onDone }: { item?: Json; onDone: () => void }) {
  const fields = useMemo(
    () => [
      ['serviceFeeCents', 'Frais de service client (centimes)'],
      ['vendorCommissionBps', 'Commission vendeur (bps, 1500 = 15 %)'],
      ['minOrderCents', 'Minimum de commande'],
      ['deliveryBaseFeeCents', 'Livraison de base'],
      ['deliveryPerKmCents', 'Livraison / km'],
      ['deliveryMaxKm', 'Rayon max livraison (km)'],
      ['courierBaseFeeCents', 'Rémunération livreur de base'],
      ['courierPerKmCents', 'Livreur / km'],
      ['courierPerVendorCents', 'Livreur / étal'],
      ['offerTimeoutSeconds', 'Timeout offre (s)'],
      ['initialSearchRadiusKm', 'Rayon recherche initial'],
      ['maxSearchRadiusKm', 'Rayon recherche max'],
      ['rainBonusCents', 'Prime pluie'],
      ['highDemandBonusCents', 'Prime forte demande'],
      ['vatFoodBps', 'TVA alimentaire (bps)'],
      ['vatServiceBps', 'TVA services (bps)'],
      ['freeCancellationSeconds', 'Délai d’annulation gratuit'],
      ['cancellationFeeCents', 'Frais d’annulation'],
    ] as const,
    [],
  );
  const [values, setValues] = useState<Record<string, number>>({});
  const [surge, setSurge] = useState(true);

  useEffect(() => {
    if (!item) return;
    const next: Record<string, number> = {};
    fields.forEach(([key]) => {
      next[key] = Number(item[key] ?? 0);
    });
    setValues(next);
    setSurge(Boolean(item.surgeEnabled));
  }, [item, fields]);

  return (
    <form
      className="grid gap-3 rounded-2xl border bg-card p-5 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await apiPost('settings', 'update', 'global', { ...values, surgeEnabled: surge });
          toast.success('Réglages enregistrés');
          onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erreur');
        }
      }}
    >
      {fields.map(([key, lab]) => (
        <label key={key} className="text-sm font-medium">
          {lab}
          <Input
            className="mt-1"
            type="number"
            value={values[key] ?? 0}
            onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))}
          />
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
        <input type="checkbox" checked={surge} onChange={(e) => setSurge(e.target.checked)} />
        Tarification dynamique (surge) activée
      </label>
      <Textarea className="md:col-span-2" readOnly value="Les modifications sont tracées dans le journal d’audit et s’appliquent aux nouvelles commandes." />
      <Button type="submit" className="md:col-span-2">
        Enregistrer les réglages
      </Button>
    </form>
  );
}

function fmtDate(value: unknown) {
  if (!value) return '—';
  return new Date(String(value)).toLocaleString('fr-BE');
}
