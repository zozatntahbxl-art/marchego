import { z } from 'zod';
import { isValidBelgianPostalCode, isValidIban, isValidVatNumber, toE164Belgian } from '@/lib/belgium';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const latLngSchema = z.object({
  latitude: z.number().min(49).max(52),
  longitude: z.number().min(2).max(7),
});

export const addressSchema = z.object({
  label: z.string().min(1).max(40).default('Domicile'),
  street: z.string().min(2).max(120),
  houseNumber: z.string().min(1).max(12),
  boxNumber: z.string().max(8).optional(),
  city: z.string().min(2).max(80),
  postalCode: z.string().refine(isValidBelgianPostalCode, 'Code postal belge invalide.'),
  instructions: z.string().max(280).optional(),
  isDefault: z.boolean().optional(),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().transform((v, ctx) => {
    const e164 = toE164Belgian(v);
    if (!e164) {
      ctx.addIssue({ code: 'custom', message: 'Numéro belge invalide.' });
      return z.NEVER;
    }
    return e164;
  }),
  role: z.enum(['CLIENT', 'LIVREUR', 'VENDEUR']).default('CLIENT'),
  language: z.enum(['FR', 'NL', 'DE', 'EN']).default('FR'),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Vous devez accepter les conditions générales.' }),
  }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  note: z.string().max(140).optional(),
});

export const cartPutSchema = z.object({
  marketId: z.string().uuid(),
  marketDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  productId: z.string().uuid(),
  quantity: z.number().int().min(0).max(50),
  note: z.string().max(140).optional(),
});

export const checkoutSchema = z.object({
  cartId: z.string().uuid(),
  addressId: z.string().uuid(),
  slotType: z.enum(['ASAP', 'PLANIFIE']).default('ASAP'),
  scheduledFor: z.string().datetime().optional(),
  tipCents: z.number().int().min(0).max(5000).default(0),
  customerNote: z.string().max(280).optional(),
  locationConsent: z.boolean().optional(),
});

export const productSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid(),
  priceCents: z.number().int().min(10).max(1_000_000),
  compareAtPriceCents: z.number().int().min(10).optional().nullable(),
  unit: z.enum([
    'PIECE',
    'KG',
    'GRAMME',
    'LITRE',
    'BOTTE',
    'BARQUETTE',
    'PORTION',
    'PAQUET',
    'DOUZAINE',
  ]),
  unitQuantity: z.number().positive().default(1),
  stock: z.number().int().min(0).default(0),
  maxPerOrder: z.number().int().min(1).max(100).default(20),
  images: z.array(z.string().url()).max(8).default([]),
  labels: z
    .array(
      z.enum([
        'BIO',
        'ARTISANAL',
        'LOCAL',
        'SANS_GLUTEN',
        'VEGAN',
        'VEGETARIEN',
        'HALAL',
        'CASHER',
        'COMMERCE_EQUITABLE',
        'FAIT_MAISON',
        'SANS_LACTOSE',
      ]),
    )
    .default([]),
  origin: z.string().max(80).optional(),
  allergens: z.array(z.string()).default([]),
  isAvailable: z.boolean().default(true),
});

export const vendorOnboardingSchema = z.object({
  businessName: z.string().min(2).max(120),
  vatNumber: z.string().refine(isValidVatNumber, 'Numéro de TVA belge invalide.'),
  iban: z.string().refine(isValidIban, 'IBAN invalide.'),
  description: z.string().max(2000).optional(),
  phone: z.string().optional(),
  primaryCategoryId: z.string().uuid().optional(),
  marketIds: z.array(z.string().uuid()).min(1, 'Sélectionnez au moins un marché.'),
  acceptedTerms: z.literal(true),
});

export const courierOnboardingSchema = z.object({
  vehicleType: z.enum(['VELO', 'VELO_CARGO', 'SCOOTER', 'VOITURE', 'CAMIONNETTE', 'A_PIED']),
  iban: z.string().refine(isValidIban, 'IBAN belge ou SEPA invalide.'),
  radiusKm: z.number().min(2).max(30).default(8),
  preferredLatitude: z.number().optional(),
  preferredLongitude: z.number().optional(),
  plateNumber: z.string().max(12).optional(),
  model: z.string().max(80).optional(),
  acceptedTerms: z.literal(true),
});

export const marketQuerySchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  q: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
  kind: z.string().max(40).optional(),
  day: z.coerce.number().int().min(0).max(6).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  openOnly: z.enum(['true', 'false']).optional(),
  radiusKm: z.coerce.number().min(1).max(50).optional(),
  category: z.string().max(80).optional(),
});

export const productQuerySchema = z.object({
  q: z.string().max(80).optional(),
  category: z.string().optional(),
  marketId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  labels: z.string().optional(),
  minPrice: z.coerce.number().int().optional(),
  maxPrice: z.coerce.number().int().optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export const disputeSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum([
    'PRODUIT_MANQUANT',
    'PRODUIT_ABIME',
    'PRODUIT_INCORRECT',
    'RETARD_IMPORTANT',
    'COMMANDE_NON_LIVREE',
    'COMPORTEMENT_INAPPROPRIE',
    'ERREUR_FACTURATION',
    'AUTRE',
  ]),
  description: z.string().min(10).max(2000),
  attachments: z.array(z.string()).max(6).default([]),
  affectedItemIds: z.array(z.string().uuid()).default([]),
  requestedRefundCents: z.number().int().min(0).optional(),
});

export const reviewSchema = z.object({
  orderId: z.string().uuid(),
  targetId: z.string().uuid(),
  targetRole: z.enum(['VENDEUR', 'LIVREUR', 'PRODUIT']),
  productId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(800).optional(),
});

export const chatMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  attachments: z.array(z.string()).max(4).optional(),
});

export const locationPingSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
  heading: z.number().optional(),
  speed: z.number().optional(),
  deliveryId: z.string().uuid().optional(),
});

export const marketAdminSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(4000).optional(),
  street: z.string().min(2),
  houseNumber: z.string().optional(),
  city: z.string().min(2),
  postalCode: z.string().refine(isValidBelgianPostalCode),
  latitude: z.number(),
  longitude: z.number(),
  zoneRadiusKm: z.number().min(1).max(30).default(6),
  imageUrl: z.string().url().optional(),
  schedules: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6).nullable(),
        dateSpecific: z.string().nullable().optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        lastOrderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      }),
    )
    .min(1),
});
