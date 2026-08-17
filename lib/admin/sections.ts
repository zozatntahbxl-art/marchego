export const ADMIN_SECTIONS = [
  'dashboard',
  'users',
  'vendors',
  'couriers',
  'markets',
  'products',
  'categories',
  'orders',
  'disputes',
  'reviews',
  'payouts',
  'holidays',
  'notifications',
  'settings',
  'audit',
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];
