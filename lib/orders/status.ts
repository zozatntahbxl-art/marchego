import { OrderStatus, VendorOrderStatus } from '@prisma/client';

/**
 * Machine à états des commandes.
 *
 * Une commande agrège plusieurs `VendorOrder` (un par étal). Le statut global
 * est dérivé des statuts vendeurs jusqu'à `PREPAREE`, puis de la livraison.
 *
 * Transitions autorisées :
 *
 *   EN_ATTENTE
 *     ├─(tous vendeurs acceptés)────────► ACCEPTEE_PAR_VENDEUR
 *     ├─(un vendeur refuse, panier unique)► ANNULEE
 *     └─(client, délai de grâce)────────► ANNULEE
 *
 *   ACCEPTEE_PAR_VENDEUR
 *     └─(tous vendeurs prêts)───────────► PREPAREE
 *
 *   PREPAREE
 *     └─(recherche livreur lancée)──────► EN_ATTENTE_DE_LIVREUR
 *
 *   EN_ATTENTE_DE_LIVREUR
 *     ├─(livreur accepte)───────────────► LIVREUR_ASSIGNE
 *     └─(timeout définitif / annulation)► ANNULEE
 *
 *   LIVREUR_ASSIGNE
 *     └─(en route vers le marché)───────► EN_ROUTE_VERS_MARCHE
 *
 *   EN_ROUTE_VERS_MARCHE
 *     └─(arrivée, début de collecte)────► EN_RECUPERATION
 *
 *   EN_RECUPERATION
 *     └─(tous les étals récupérés)──────► EN_ROUTE_VERS_CLIENT
 *
 *   EN_ROUTE_VERS_CLIENT
 *     ├─(preuve validée)────────────────► LIVREE
 *     └─(échec de remise)───────────────► ANNULEE  (escalade admin)
 */

const VENDOR_VISIBLE: Record<VendorOrderStatus, string> = {
  EN_ATTENTE: 'Nouvelle commande',
  ACCEPTEE: 'Acceptée',
  EN_PREPARATION: 'En préparation',
  PRETE: 'Prête au retrait',
  RECUPEREE: 'Récupérée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

export function vendorStatusLabel(status: VendorOrderStatus | string): string {
  return VENDOR_VISIBLE[status as VendorOrderStatus] ?? status;
}

const COURIER_VISIBLE: Record<string, string> = {
  NON_ASSIGNEE: 'En attente',
  RECHERCHE_LIVREUR: 'Recherche',
  ASSIGNEE: 'Course acceptée',
  EN_ROUTE_VERS_MARCHE: 'Vers le marché',
  ARRIVE_AU_MARCHE: 'Au marché',
  EN_RECUPERATION: 'Collecte des étals',
  EN_ROUTE_VERS_CLIENT: 'Vers le client',
  ARRIVE_CHEZ_CLIENT: 'Chez le client',
  LIVREE: 'Livrée',
  ECHOUEE: 'Échec',
  ANNULEE: 'Annulée',
};

export function courierStatusLabel(status: string): string {
  return COURIER_VISIBLE[status] ?? status;
}

/** Étapes simplifiées pour le suivi client (5 pastilles). */
export const CLIENT_TRACK_STEPS = [
  { id: 'vendors', label: 'Étals', match: ['EN_ATTENTE'] },
  { id: 'prep', label: 'Préparation', match: ['ACCEPTEE_PAR_VENDEUR'] },
  { id: 'ready', label: 'Prête', match: ['PREPAREE', 'EN_ATTENTE_DE_LIVREUR'] },
  { id: 'courier', label: 'Livreur', match: ['LIVREUR_ASSIGNE', 'EN_ROUTE_VERS_MARCHE', 'EN_RECUPERATION'] },
  { id: 'route', label: 'Chez vous', match: ['EN_ROUTE_VERS_CLIENT', 'LIVREE'] },
] as const;

export function clientTrackIndex(status: OrderStatus): number {
  if (status === 'ANNULEE') return -1;
  if (status === 'LIVREE') return CLIENT_TRACK_STEPS.length - 1;
  const i = CLIENT_TRACK_STEPS.findIndex((s) => (s.match as readonly string[]).includes(status));
  return i < 0 ? 0 : i;
}

const CLIENT_VISIBLE: Record<OrderStatus, string> = {
  EN_ATTENTE: 'En attente des vendeurs',
  ACCEPTEE_PAR_VENDEUR: 'Acceptée, en préparation',
  PREPAREE: 'Prête au marché',
  EN_ATTENTE_DE_LIVREUR: 'Recherche d’un livreur',
  LIVREUR_ASSIGNE: 'Livreur en route vers le marché',
  EN_ROUTE_VERS_MARCHE: 'Livreur en route vers le marché',
  EN_RECUPERATION: 'Récupération des courses',
  EN_ROUTE_VERS_CLIENT: 'En route vers vous',
  LIVREE: 'Livrée',
  ANNULEE: 'Annulée',
};

export function orderStatusLabel(status: OrderStatus): string {
  return CLIENT_VISIBLE[status];
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  EN_ATTENTE: ['ACCEPTEE_PAR_VENDEUR', 'ANNULEE'],
  ACCEPTEE_PAR_VENDEUR: ['PREPAREE', 'ANNULEE'],
  PREPAREE: ['EN_ATTENTE_DE_LIVREUR', 'ANNULEE'],
  EN_ATTENTE_DE_LIVREUR: ['LIVREUR_ASSIGNE', 'ANNULEE'],
  LIVREUR_ASSIGNE: ['EN_ROUTE_VERS_MARCHE', 'EN_ATTENTE_DE_LIVREUR', 'ANNULEE'],
  EN_ROUTE_VERS_MARCHE: ['EN_RECUPERATION', 'ANNULEE'],
  EN_RECUPERATION: ['EN_ROUTE_VERS_CLIENT', 'ANNULEE'],
  EN_ROUTE_VERS_CLIENT: ['LIVREE', 'ANNULEE'],
  LIVREE: [],
  ANNULEE: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Transition de commande interdite : ${from} → ${to}`);
  }
}

const TERMINAL: OrderStatus[] = ['LIVREE', 'ANNULEE'];

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL.includes(status);
}

/** Statuts à partir desquels le client peut encore annuler. */
export function isCancellableByClient(status: OrderStatus, secondsSinceOrder: number, graceSeconds: number): boolean {
  if (status === 'EN_ATTENTE') return true;
  if (status === 'ACCEPTEE_PAR_VENDEUR' && secondsSinceOrder <= graceSeconds) return true;
  return false;
}

/**
 * Agrège les statuts des sous-commandes vendeurs pour produire le statut
 * global de la commande, tant qu'on n'est pas encore dans la phase livraison.
 */
export function deriveOrderStatusFromVendors(
  vendorStatuses: VendorOrderStatus[],
  current: OrderStatus,
): OrderStatus {
  if (isTerminalStatus(current) || vendorStatuses.length === 0) return current;

  // Un refus unique sur une commande mono-vendeur annule tout. Sur une
  // commande multi-vendeurs, le refus d'un étal est géré par remboursement
  // partiel : on continue avec les autres.
  const allRefused = vendorStatuses.every((s) => s === 'REFUSEE' || s === 'ANNULEE');
  if (allRefused) return 'ANNULEE';

  const active = vendorStatuses.filter((s) => s !== 'REFUSEE' && s !== 'ANNULEE');
  if (active.length === 0) return 'ANNULEE';

  const allReady = active.every((s) => s === 'PRETE' || s === 'RECUPEREE');
  const allAccepted = active.every(
    (s) => s === 'ACCEPTEE' || s === 'EN_PREPARATION' || s === 'PRETE' || s === 'RECUPEREE',
  );

  if (current === 'EN_ATTENTE' && allAccepted) return 'ACCEPTEE_PAR_VENDEUR';
  if (
    (current === 'EN_ATTENTE' || current === 'ACCEPTEE_PAR_VENDEUR') &&
    allReady
  ) {
    return 'PREPAREE';
  }
  return current;
}

const VENDOR_ALLOWED: Record<VendorOrderStatus, VendorOrderStatus[]> = {
  EN_ATTENTE: ['ACCEPTEE', 'REFUSEE', 'ANNULEE'],
  ACCEPTEE: ['EN_PREPARATION', 'PRETE', 'ANNULEE'],
  EN_PREPARATION: ['PRETE', 'ANNULEE'],
  PRETE: ['RECUPEREE', 'ANNULEE'],
  RECUPEREE: [],
  REFUSEE: [],
  ANNULEE: [],
};

export function canVendorTransition(from: VendorOrderStatus, to: VendorOrderStatus): boolean {
  return VENDOR_ALLOWED[from]?.includes(to) ?? false;
}

/** Progression 0–1 pour la barre de suivi client. */
export function orderProgress(status: OrderStatus): number {
  const steps: OrderStatus[] = [
    'EN_ATTENTE',
    'ACCEPTEE_PAR_VENDEUR',
    'PREPAREE',
    'EN_ATTENTE_DE_LIVREUR',
    'LIVREUR_ASSIGNE',
    'EN_ROUTE_VERS_MARCHE',
    'EN_RECUPERATION',
    'EN_ROUTE_VERS_CLIENT',
    'LIVREE',
  ];
  if (status === 'ANNULEE') return 0;
  const i = steps.indexOf(status);
  return i < 0 ? 0 : i / (steps.length - 1);
}
