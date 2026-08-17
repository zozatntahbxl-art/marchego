import {
  Language,
  PrismaClient,
  ProductLabel,
  ProductUnit,
  UserRole,
  VehicleType,
} from '@prisma/client';
import { belgianHolidays } from '../lib/belgium';
import { BELGIAN_MARKETS } from '../lib/data/belgian-markets';
import { slugify } from '../lib/utils';

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: 'fruits-legumes', nameFr: 'Fruits & légumes', nameNl: 'Fruit & groenten', nameDe: 'Obst & Gemüse', nameEn: 'Fruit & vegetables', icon: '🥬', color: '#529a3c', vatRateBps: 600, sortOrder: 1 },
  { slug: 'boucherie', nameFr: 'Boucherie / Charcuterie', nameNl: 'Slagerij', nameDe: 'Metzgerei', nameEn: 'Butchery', icon: '🥩', color: '#b91c1c', vatRateBps: 600, sortOrder: 2 },
  { slug: 'fromages', nameFr: 'Fromages / Produits laitiers', nameNl: 'Kaas & zuivel', nameDe: 'Käse & Milch', nameEn: 'Cheese & dairy', icon: '🧀', color: '#f59e0b', vatRateBps: 600, sortOrder: 3 },
  { slug: 'boulangerie', nameFr: 'Boulangerie / Pâtisserie', nameNl: 'Bakkerij', nameDe: 'Bäckerei', nameEn: 'Bakery', icon: '🥖', color: '#d97706', vatRateBps: 600, sortOrder: 4 },
  { slug: 'epicerie', nameFr: 'Épicerie fine', nameNl: 'Fijne kruidenier', nameDe: 'Feinkost', nameEn: 'Fine grocery', icon: '🫙', color: '#7c3aed', vatRateBps: 600, sortOrder: 5 },
  { slug: 'fleurs', nameFr: 'Fleurs & plantes', nameNl: 'Bloemen & planten', nameDe: 'Blumen', nameEn: 'Flowers', icon: '🌷', color: '#db2777', vatRateBps: 600, sortOrder: 6 },
  { slug: 'plats', nameFr: 'Plats préparés', nameNl: 'Bereide gerechten', nameDe: 'Fertiggerichte', nameEn: 'Prepared meals', icon: '🍲', color: '#ea580c', vatRateBps: 600, sortOrder: 7 },
  { slug: 'boissons', nameFr: 'Boissons', nameNl: 'Dranken', nameDe: 'Getränke', nameEn: 'Drinks', icon: '🍾', color: '#2563eb', vatRateBps: 2100, sortOrder: 8 },
  { slug: 'hygiene', nameFr: 'Hygiène / Ménager', nameNl: 'Hygiëne', nameDe: 'Hygiene', nameEn: 'Household', icon: '🧼', color: '#0d9488', vatRateBps: 2100, sortOrder: 9 },
];

const MARKETS = BELGIAN_MARKETS;

type VendorSeed = {
  email: string;
  firstName: string;
  lastName: string;
  businessName: string;
  vatNumber: string;
  category: string;
  description: string;
  markets: string[];
  products: Array<{
    name: string;
    priceCents: number;
    unit: ProductUnit;
    category: string;
    stock: number;
    labels?: ProductLabel[];
    origin?: string;
  }>;
};

const VENDORS: VendorSeed[] = [
  {
    email: 'fromagerie.vandijck@marchego.be',
    firstName: 'Marie',
    lastName: 'Van Dijck',
    businessName: 'Fromagerie Van Dijck',
    vatNumber: 'BE0123456749',
    category: 'fromages',
    description: 'Herve, Chimay et chèvres de Flandre, affinés à Bruxelles.',
    markets: ['gare-du-midi', 'flagey', 'sainte-catherine'],
    products: [
      { name: 'Herve AOP 200 g', priceCents: 495, unit: 'PIECE', category: 'fromages', stock: 40, labels: ['LOCAL', 'ARTISANAL'], origin: 'Herve' },
      { name: 'Chimay Grand Classique', priceCents: 620, unit: 'PIECE', category: 'fromages', stock: 30, labels: ['LOCAL'], origin: 'Chimay' },
      { name: 'Chèvre frais aux herbes', priceCents: 380, unit: 'PIECE', category: 'fromages', stock: 25, labels: ['BIO', 'ARTISANAL'], origin: 'Pajottenland' },
      { name: 'Beurre de ferme 250 g', priceCents: 350, unit: 'PIECE', category: 'fromages', stock: 50, labels: ['BIO', 'LOCAL'] },
    ],
  },
  {
    email: 'maraicher.dubois@marchego.be',
    firstName: 'Luc',
    lastName: 'Dubois',
    businessName: 'Maraîcher Dubois',
    vatNumber: 'BE0234567850',
    category: 'fruits-legumes',
    description: 'Légumes de saison cultivés à Hoeilaart et au Brabant wallon.',
    markets: ['gare-du-midi', 'flagey'],
    products: [
      { name: 'Tomates cœur de bœuf', priceCents: 390, unit: 'KG', category: 'fruits-legumes', stock: 80, labels: ['BIO', 'LOCAL'], origin: 'Hoeilaart' },
      { name: 'Botte de carottes', priceCents: 220, unit: 'BOTTE', category: 'fruits-legumes', stock: 60, labels: ['BIO'] },
      { name: 'Pommes Jonagold', priceCents: 250, unit: 'KG', category: 'fruits-legumes', stock: 100, labels: ['LOCAL'], origin: 'Hesbaye' },
      { name: 'Salade feuille de chêne', priceCents: 180, unit: 'PIECE', category: 'fruits-legumes', stock: 45, labels: ['BIO'] },
      { name: 'Fraises de Wépion 500 g', priceCents: 650, unit: 'BARQUETTE', category: 'fruits-legumes', stock: 20, labels: ['LOCAL'], origin: 'Wépion' },
    ],
  },
  {
    email: 'boulangerie.lecomte@marchego.be',
    firstName: 'Pierre',
    lastName: 'Lecomte',
    businessName: 'Boulangerie Lecomte',
    vatNumber: 'BE0345678961',
    category: 'boulangerie',
    description: 'Pain au levain cuit au feu de bois, pâtisseries belges.',
    markets: ['flagey', 'sainte-catherine', 'namur-armes'],
    products: [
      { name: 'Pain au levain 800 g', priceCents: 420, unit: 'PIECE', category: 'boulangerie', stock: 40, labels: ['ARTISANAL', 'FAIT_MAISON'] },
      { name: 'Pistolet beurre', priceCents: 80, unit: 'PIECE', category: 'boulangerie', stock: 80, labels: ['FAIT_MAISON'] },
      { name: 'Tarte au riz', priceCents: 1450, unit: 'PIECE', category: 'boulangerie', stock: 12, labels: ['LOCAL', 'FAIT_MAISON'] },
      { name: 'Gaufre de Liège', priceCents: 250, unit: 'PIECE', category: 'boulangerie', stock: 40, labels: ['LOCAL'] },
    ],
  },
  {
    email: 'boucherie.martin@marchego.be',
    firstName: 'Ahmed',
    lastName: 'Martin',
    businessName: 'Boucherie Martin',
    vatNumber: 'BE0456789072',
    category: 'boucherie',
    description: 'Viandes belges, merguez et volaille fermière.',
    markets: ['gare-du-midi', 'liege-batte'],
    products: [
      { name: 'Steak haché 15 % 500 g', priceCents: 690, unit: 'BARQUETTE', category: 'boucherie', stock: 30, labels: ['LOCAL'] },
      { name: 'Poulet fermier entier', priceCents: 1290, unit: 'PIECE', category: 'boucherie', stock: 15, labels: ['BIO'] },
      { name: 'Merguez x6', priceCents: 780, unit: 'PAQUET', category: 'boucherie', stock: 25, labels: ['HALAL'] },
    ],
  },
  {
    email: 'fleurs.peeters@marchego.be',
    firstName: 'Sofie',
    lastName: 'Peeters',
    businessName: 'Fleurs Peeters',
    vatNumber: 'BE0567890183',
    category: 'fleurs',
    description: 'Tulipes, pivoines et plantes d’intérieur du Meetjesland.',
    markets: ['anvers-theaterplein', 'gand-groentenmarkt', 'flagey'],
    products: [
      { name: 'Bouquet de tulipes (10)', priceCents: 850, unit: 'BOTTE', category: 'fleurs', stock: 25, labels: ['LOCAL'] },
      { name: 'Basilique en pot', priceCents: 390, unit: 'PIECE', category: 'fleurs', stock: 20, labels: ['BIO'] },
    ],
  },
];

function validVatLike(index: number): string {
  const eight = String(12_345_670 + index).padStart(8, '0').slice(-8);
  const check = String(97 - (Number(eight) % 97)).padStart(2, '0');
  return `BE${eight}${check}`;
}

async function main() {
  console.info('🌱 Seed MarchéGo…');

  await prisma.platformSettings.upsert({
    where: { id: 'global' },
    create: { id: 'global' },
    update: {},
  });

  const year = new Date().getFullYear();
  for (const y of [year, year + 1]) {
    for (const h of belgianHolidays(y)) {
      await prisma.belgianHoliday.upsert({
        where: { date: h.date },
        create: { date: h.date, nameFr: h.nameFr, nameNl: h.nameNl, nameDe: h.nameDe, nameEn: h.nameEn },
        update: { nameFr: h.nameFr },
      });
    }
  }

  const catMap = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { nameFr: c.nameFr, icon: c.icon },
    });
    catMap.set(c.slug, row.id);
  }

  const marketMap = new Map<string, string>();
  for (const m of MARKETS) {
    const payload = {
      name: m.name,
      description: m.description,
      street: m.street,
      houseNumber: m.houseNumber ?? '',
      city: m.city,
      postalCode: m.postalCode,
      latitude: m.latitude,
      longitude: m.longitude,
      zoneRadiusKm: m.zoneRadiusKm,
      imageUrl: m.imageUrl,
      kind: m.type,
      region: m.region,
      featured: m.featured ?? false,
      stallCount: m.stallCount ?? null,
      highlights: m.highlights ?? [],
    };
    const row = await prisma.market.upsert({
      where: { slug: m.slug },
      create: {
        ...payload,
        slug: m.slug,
        status: 'FERME',
        schedules: {
          create: m.schedules.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            lastOrderTime: s.lastOrderTime,
          })),
        },
      },
      update: payload,
    });
    await prisma.marketSchedule.deleteMany({ where: { marketId: row.id } });
    await prisma.marketSchedule.createMany({
      data: m.schedules.map((s) => ({
        marketId: row.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        lastOrderTime: s.lastOrderTime,
      })),
    });
    marketMap.set(m.slug, row.id);
  }

  await upsertUser({
    email: 'admin@marchego.be',
    firstName: 'Inès',
    lastName: 'Lambert',
    phone: '+32470000001',
    roles: ['ADMIN', 'CLIENT'],
    activeRole: 'ADMIN',
  });

  const client = await upsertUser({
    email: 'client@marchego.be',
    firstName: 'Thomas',
    lastName: 'Janssens',
    phone: '+32470111222',
    roles: ['CLIENT'],
  });

  await prisma.address.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      userId: client.id,
      label: 'Domicile',
      street: 'Rue de la Loi',
      houseNumber: '16',
      city: 'Bruxelles',
      postalCode: '1000',
      latitude: 50.8467,
      longitude: 4.3676,
      isDefault: true,
    },
    update: {},
  });

  const courierUser = await upsertUser({
    email: 'livreur@marchego.be',
    firstName: 'Karim',
    lastName: 'El Idrissi',
    phone: '+32470333444',
    roles: ['LIVREUR', 'CLIENT'],
    activeRole: 'LIVREUR',
  });

  await prisma.courier.upsert({
    where: { userId: courierUser.id },
    create: {
      userId: courierUser.id,
      vehicleType: VehicleType.VELO_CARGO,
      verified: true,
      status: 'ACTIF',
      verificationStatus: 'APPROUVE',
      online: false,
      radiusKm: 8,
      currentLatitude: 50.84,
      currentLongitude: 4.34,
      lastLocationUpdate: new Date(),
      ibanLast4: '7034',
      acceptedTermsAt: new Date(),
      vehicles: { create: { type: 'VELO_CARGO', model: 'Urban Arrow', isPrimary: true, capacityLiters: 120 } },
    },
    update: { verified: true, status: 'ACTIF' },
  });

  let i = 0;
  for (const v of VENDORS) {
    i += 1;
    const user = await upsertUser({
      email: v.email,
      firstName: v.firstName,
      lastName: v.lastName,
      phone: `+32470${String(20000 + i).padStart(6, '0')}`,
      roles: ['VENDEUR', 'CLIENT'],
      activeRole: 'VENDEUR',
    });
    const vat = validVatLike(i);
    const vendor = await prisma.vendor.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        businessName: v.businessName,
        slug: slugify(v.businessName),
        description: v.description,
        vatNumber: vat,
        ibanLast4: '1234',
        verified: true,
        status: 'ACTIF',
        verificationStatus: 'APPROUVE',
        primaryCategoryId: catMap.get(v.category),
        rating: 4.6,
        ratingCount: 24,
        acceptedTermsAt: new Date(),
      },
      update: { verified: true, status: 'ACTIF' },
    });

    let stall = 1;
    for (const slug of v.markets) {
      const marketId = marketMap.get(slug);
      if (!marketId) continue;
      await prisma.marketVendor.upsert({
        where: { marketId_vendorId: { marketId, vendorId: vendor.id } },
        create: { marketId, vendorId: vendor.id, stallNumber: String(10 + stall), isPresent: true, approvedAt: new Date() },
        update: { isPresent: true },
      });
      stall += 1;
    }

    for (const p of v.products) {
      const product = await prisma.product.upsert({
        where: { vendorId_slug: { vendorId: vendor.id, slug: slugify(p.name) } },
        create: {
          vendorId: vendor.id,
          categoryId: catMap.get(p.category)!,
          name: p.name,
          slug: slugify(p.name),
          priceCents: p.priceCents,
          unit: p.unit,
          stock: p.stock,
          labels: p.labels ?? [],
          origin: p.origin,
          isAvailable: true,
          isApproved: true,
          images: [],
        },
        update: { priceCents: p.priceCents, stock: p.stock },
      });
      for (const slug of v.markets) {
        const marketId = marketMap.get(slug);
        if (!marketId) continue;
        const existing = await prisma.marketProductAvailability.findFirst({
          where: { marketId, productId: product.id, date: null },
        });
        if (existing) {
          await prisma.marketProductAvailability.update({
            where: { id: existing.id },
            data: { stock: p.stock, isAvailable: true },
          });
        } else {
          await prisma.marketProductAvailability.create({
            data: { marketId, productId: product.id, stock: p.stock, isAvailable: true },
          });
        }
      }
    }
  }

  console.info(`✅ Seed OK — ${MARKETS.length} marchés belges (Bruxelles / Flandre / Wallonie)`);
  console.info('   admin@marchego.be / client@marchego.be / livreur@marchego.be / vendeurs @marchego.be');
}

async function upsertUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  roles: UserRole[];
  activeRole?: UserRole;
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      phone: input.phone,
      roles: input.roles,
      activeRole: input.activeRole ?? input.roles[0],
      status: 'ACTIF',
      emailVerified: true,
      phoneVerified: true,
      profile: {
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
          language: Language.FR,
        },
      },
    },
    update: { roles: input.roles, status: 'ACTIF' },
  });
  return user;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
