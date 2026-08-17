import 'server-only';
import {
  AccountStatus,
  DisputeStatus,
  MarketStatus,
  OrderStatus,
  Prisma,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { HttpError } from '@/lib/http';
import { slugify } from '@/lib/utils';
import { integrations } from '@/lib/env';
import { refundPayment } from '@/lib/stripe/payments';
import { invalidateSettingsCache } from '@/lib/settings';

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

function audit(adminId: string, action: string, targetType: string, targetId: string, metadata: Prisma.InputJsonValue = {}) {
  return prisma.auditLog.create({
    data: { adminId, action, targetType, targetId, metadata },
  });
}

export async function adminDashboard() {
  const since = new Date(Date.now() - 7 * 86400000);
  const [
    liveOrders,
    vendorsPending,
    couriersPending,
    openDisputes,
    users,
    vendors,
    couriers,
    markets,
    products,
    gmv,
    weekGmv,
    recentOrders,
    recentAudit,
  ] = await Promise.all([
    prisma.order.count({ where: { status: { notIn: ['LIVREE', 'ANNULEE'] } } }),
    prisma.vendor.count({ where: { verificationStatus: 'EN_ATTENTE' } }),
    prisma.courier.count({ where: { verificationStatus: 'EN_ATTENTE' } }),
    prisma.dispute.count({ where: { status: { in: ['OUVERT', 'EN_EXAMEN'] } } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.vendor.count(),
    prisma.courier.count({ where: { online: true } }),
    prisma.market.count({ where: { isActive: true } }),
    prisma.product.count(),
    prisma.order.aggregate({
      where: { paymentStatus: 'PAYE' },
      _sum: { totalCents: true, platformFeeCents: true },
    }),
    prisma.order.aggregate({
      where: { paymentStatus: 'PAYE', createdAt: { gte: since } },
      _sum: { totalCents: true, platformFeeCents: true },
      _count: true,
    }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { market: { select: { name: true } }, client: { select: { email: true } } },
    }),
    prisma.auditLog.findMany({
      take: 12,
      orderBy: { createdAt: 'desc' },
      include: { admin: { select: { email: true } } },
    }),
  ]);

  return {
    kpis: {
      liveOrders,
      vendorsPending,
      couriersPending,
      openDisputes,
      users,
      vendors,
      couriersOnline: couriers,
      markets,
      products,
      gmvCents: gmv._sum.totalCents ?? 0,
      platformCents: gmv._sum.platformFeeCents ?? 0,
      weekGmvCents: weekGmv._sum.totalCents ?? 0,
      weekOrders: weekGmv._count,
    },
    recentOrders,
    recentAudit,
  };
}

export async function listResource(resource: string, params: { q?: string; page: number; limit: number }) {
  const skip = (params.page - 1) * params.limit;
  const q = params.q?.trim();

  switch (resource) {
    case 'users': {
      const where: Prisma.UserWhereInput = q
        ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] }
        : {};
      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: params.limit,
          orderBy: { createdAt: 'desc' },
          include: { profile: true, vendor: true, courier: true },
        }),
        prisma.user.count({ where }),
      ]);
      return { items, total };
    }
    case 'vendors': {
      const where: Prisma.VendorWhereInput = q
        ? { OR: [{ businessName: { contains: q, mode: 'insensitive' } }, { vatNumber: { contains: q } }] }
        : {};
      const [items, total] = await Promise.all([
        prisma.vendor.findMany({
          where,
          skip,
          take: params.limit,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { email: true } }, primaryCategory: true, _count: { select: { products: true } } },
        }),
        prisma.vendor.count({ where }),
      ]);
      return { items, total };
    }
    case 'couriers': {
      const where: Prisma.CourierWhereInput = q ? { user: { email: { contains: q, mode: 'insensitive' } } } : {};
      const [items, total] = await Promise.all([
        prisma.courier.findMany({
          where,
          skip,
          take: params.limit,
          orderBy: { updatedAt: 'desc' },
          include: { user: { include: { profile: true } } },
        }),
        prisma.courier.count({ where }),
      ]);
      return { items, total };
    }
    case 'markets': {
      const where: Prisma.MarketWhereInput = q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }] }
        : {};
      const [items, total] = await Promise.all([
        prisma.market.findMany({
          where,
          skip,
          take: params.limit,
          orderBy: { name: 'asc' },
          include: {
            schedules: true,
            closures: true,
            marketVendors: { include: { vendor: { select: { id: true, businessName: true } } } },
            _count: { select: { orders: true } },
          },
        }),
        prisma.market.count({ where }),
      ]);
      return { items, total };
    }
    case 'products': {
      const where: Prisma.ProductWhereInput = q ? { name: { contains: q, mode: 'insensitive' } } : {};
      const [items, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: params.limit,
          orderBy: { updatedAt: 'desc' },
          include: { vendor: { select: { businessName: true } }, category: true },
        }),
        prisma.product.count({ where }),
      ]);
      return { items, total };
    }
    case 'categories': {
      const items = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
      return { items, total: items.length };
    }
    case 'orders': {
      const where: Prisma.OrderWhereInput = q
        ? { OR: [{ reference: { contains: q, mode: 'insensitive' } }, { client: { email: { contains: q, mode: 'insensitive' } } }] }
        : {};
      const [items, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: params.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            market: { select: { name: true } },
            client: { select: { email: true } },
            payment: true,
            delivery: true,
          },
        }),
        prisma.order.count({ where }),
      ]);
      return { items, total };
    }
    case 'disputes': {
      const [items, total] = await Promise.all([
        prisma.dispute.findMany({
          skip,
          take: params.limit,
          orderBy: { createdAt: 'desc' },
          include: { order: { select: { reference: true, totalCents: true } }, openedBy: { select: { email: true } } },
        }),
        prisma.dispute.count(),
      ]);
      return { items, total };
    }
    case 'reviews': {
      const [items, total] = await Promise.all([
        prisma.review.findMany({
          skip,
          take: params.limit,
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { email: true } } },
        }),
        prisma.review.count(),
      ]);
      return { items, total };
    }
    case 'payouts': {
      const [items, total] = await Promise.all([
        prisma.payout.findMany({ skip, take: params.limit, orderBy: { createdAt: 'desc' } }),
        prisma.payout.count(),
      ]);
      return { items, total };
    }
    case 'holidays': {
      const items = await prisma.belgianHoliday.findMany({ orderBy: { date: 'asc' } });
      return { items, total: items.length };
    }
    case 'notifications': {
      const [items, total] = await Promise.all([
        prisma.notification.findMany({
          skip,
          take: params.limit,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { email: true } } },
        }),
        prisma.notification.count(),
      ]);
      return { items, total };
    }
    case 'audit': {
      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          skip,
          take: params.limit,
          orderBy: { createdAt: 'desc' },
          include: { admin: { select: { email: true } } },
        }),
        prisma.auditLog.count(),
      ]);
      return { items, total };
    }
    case 'settings': {
      const settings = await prisma.platformSettings.findUnique({ where: { id: 'global' } });
      return { items: settings ? [settings] : [], total: 1 };
    }
    default:
      throw new HttpError(400, 'Ressource inconnue.');
  }
}

export async function mutateResource(params: {
  adminId: string;
  resource: string;
  action: string;
  id?: string;
  data?: Record<string, unknown>;
}) {
  const { adminId, resource, action, id, data = {} } = params;

  if (resource === 'users') {
    if (!id) throw new HttpError(400, 'id requis.');
    if (action === 'update') {
      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(typeof data.email === 'string' ? { email: data.email } : {}),
          ...(typeof data.status === 'string' ? { status: data.status as AccountStatus } : {}),
          ...(Array.isArray(data.roles) ? { roles: data.roles as UserRole[] } : {}),
          ...(typeof data.phoneVerified === 'boolean' ? { phoneVerified: data.phoneVerified } : {}),
        },
      });
      await audit(adminId, 'UPDATE_USER', 'User', id, data as Prisma.InputJsonValue);
      return user;
    }
    if (action === 'suspend') {
      const user = await prisma.user.update({ where: { id }, data: { status: 'SUSPENDU' } });
      await audit(adminId, 'SUSPEND_USER', 'User', id);
      return user;
    }
    if (action === 'activate') {
      const user = await prisma.user.update({ where: { id }, data: { status: 'ACTIF' } });
      await audit(adminId, 'ACTIVATE_USER', 'User', id);
      return user;
    }
  }

  if (resource === 'vendors') {
    if (!id) throw new HttpError(400, 'id requis.');
    if (action === 'verify') {
      const decision = (data.decision as VerificationStatus) ?? 'APPROUVE';
      const vendor = await prisma.vendor.update({
        where: { id },
        data: {
          verificationStatus: decision,
          verified: decision === 'APPROUVE',
          status: decision === 'APPROUVE' ? 'ACTIF' : 'EN_ATTENTE',
        },
      });
      await prisma.vendorVerification.upsert({
        where: { vendorId: id },
        create: { vendorId: id, status: decision, reviewedAt: new Date(), reviewedById: adminId },
        update: { status: decision, reviewedAt: new Date(), reviewedById: adminId, rejectionReason: String(data.reason ?? '') },
      });
      await audit(adminId, 'VERIFY_VENDOR', 'Vendor', id, { decision });
      return vendor;
    }
    if (action === 'update') {
      const vendor = await prisma.vendor.update({
        where: { id },
        data: {
          ...(typeof data.businessName === 'string' ? { businessName: data.businessName } : {}),
          ...(typeof data.description === 'string' ? { description: data.description } : {}),
          ...(typeof data.status === 'string' ? { status: data.status as AccountStatus } : {}),
          ...(typeof data.commissionBpsOverride === 'number' ? { commissionBpsOverride: data.commissionBpsOverride } : {}),
        },
      });
      await audit(adminId, 'UPDATE_VENDOR', 'Vendor', id, data as Prisma.InputJsonValue);
      return vendor;
    }
  }

  if (resource === 'couriers') {
    if (!id) throw new HttpError(400, 'id requis.');
    if (action === 'verify') {
      const decision = (data.decision as VerificationStatus) ?? 'APPROUVE';
      const courier = await prisma.courier.update({
        where: { id },
        data: {
          verificationStatus: decision,
          verified: decision === 'APPROUVE',
          status: decision === 'APPROUVE' ? 'ACTIF' : 'EN_ATTENTE',
        },
      });
      await prisma.courierVerification.upsert({
        where: { courierId: id },
        create: { courierId: id, status: decision, reviewedAt: new Date(), reviewedById: adminId },
        update: { status: decision, reviewedAt: new Date(), reviewedById: adminId, rejectionReason: String(data.reason ?? '') },
      });
      await audit(adminId, 'VERIFY_COURIER', 'Courier', id, { decision });
      return courier;
    }
    if (action === 'update') {
      const courier = await prisma.courier.update({
        where: { id },
        data: {
          ...(typeof data.online === 'boolean' ? { online: data.online } : {}),
          ...(typeof data.radiusKm === 'number' ? { radiusKm: data.radiusKm } : {}),
          ...(typeof data.status === 'string' ? { status: data.status as AccountStatus } : {}),
          ...(typeof data.vehicleType === 'string' ? { vehicleType: data.vehicleType as never } : {}),
        },
      });
      await audit(adminId, 'UPDATE_COURIER', 'Courier', id, data as Prisma.InputJsonValue);
      return courier;
    }
  }

  if (resource === 'markets') {
    if (action === 'create') {
      const name = String(data.name ?? '');
      if (!name) throw new HttpError(400, 'Nom requis.');
      const market = await prisma.market.create({
        data: {
          name,
          slug: String(data.slug || slugify(name)),
          description: typeof data.description === 'string' ? data.description : null,
          street: String(data.street ?? ''),
          city: String(data.city ?? ''),
          postalCode: String(data.postalCode ?? '1000'),
          latitude: Number(data.latitude ?? 50.8467),
          longitude: Number(data.longitude ?? 4.3525),
          zoneRadiusKm: Number(data.zoneRadiusKm ?? 6),
          isActive: true,
        },
      });
      await audit(adminId, 'CREATE_MARKET', 'Market', market.id, data as Prisma.InputJsonValue);
      return market;
    }
    if (!id) throw new HttpError(400, 'id requis.');
    if (action === 'update') {
      const market = await prisma.market.update({
        where: { id },
        data: {
          ...(typeof data.name === 'string' ? { name: data.name } : {}),
          ...(typeof data.description === 'string' ? { description: data.description } : {}),
          ...(typeof data.city === 'string' ? { city: data.city } : {}),
          ...(typeof data.street === 'string' ? { street: data.street } : {}),
          ...(typeof data.postalCode === 'string' ? { postalCode: data.postalCode } : {}),
          ...(typeof data.zoneRadiusKm === 'number' ? { zoneRadiusKm: data.zoneRadiusKm } : {}),
          ...(typeof data.latitude === 'number' ? { latitude: data.latitude } : {}),
          ...(typeof data.longitude === 'number' ? { longitude: data.longitude } : {}),
          ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
          ...(typeof data.statusLocked === 'boolean' ? { statusLocked: data.statusLocked } : {}),
          ...(typeof data.status === 'string' ? { status: data.status as MarketStatus } : {}),
        },
      });
      await audit(adminId, 'UPDATE_MARKET', 'Market', id, data as Prisma.InputJsonValue);
      return market;
    }
    if (action === 'addSchedule') {
      const schedule = await prisma.marketSchedule.create({
        data: {
          marketId: id,
          dayOfWeek: typeof data.dayOfWeek === 'number' ? data.dayOfWeek : null,
          startTime: String(data.startTime ?? '08:00'),
          endTime: String(data.endTime ?? '14:00'),
          lastOrderTime: typeof data.lastOrderTime === 'string' ? data.lastOrderTime : null,
        },
      });
      await audit(adminId, 'ADD_SCHEDULE', 'Market', id, data as Prisma.InputJsonValue);
      return schedule;
    }
    if (action === 'assignVendor') {
      const mv = await prisma.marketVendor.upsert({
        where: { marketId_vendorId: { marketId: id, vendorId: String(data.vendorId) } },
        create: {
          marketId: id,
          vendorId: String(data.vendorId),
          stallNumber: typeof data.stallNumber === 'string' ? data.stallNumber : null,
          isPresent: true,
          approvedAt: new Date(),
        },
        update: {
          stallNumber: typeof data.stallNumber === 'string' ? data.stallNumber : undefined,
          isPresent: typeof data.isPresent === 'boolean' ? data.isPresent : true,
        },
      });
      await audit(adminId, 'ASSIGN_VENDOR', 'Market', id, data as Prisma.InputJsonValue);
      return mv;
    }
    if (action === 'delete') {
      await prisma.market.update({ where: { id }, data: { isActive: false, statusLocked: true, status: 'FERME' } });
      await audit(adminId, 'DEACTIVATE_MARKET', 'Market', id);
      return { ok: true };
    }
  }

  if (resource === 'products') {
    if (!id) throw new HttpError(400, 'id requis.');
    if (action === 'update') {
      const product = await prisma.product.update({
        where: { id },
        data: {
          ...(typeof data.name === 'string' ? { name: data.name } : {}),
          ...(typeof data.priceCents === 'number' ? { priceCents: data.priceCents } : {}),
          ...(typeof data.stock === 'number' ? { stock: data.stock } : {}),
          ...(typeof data.isAvailable === 'boolean' ? { isAvailable: data.isAvailable } : {}),
          ...(typeof data.isApproved === 'boolean' ? { isApproved: data.isApproved } : {}),
        },
      });
      await audit(adminId, 'UPDATE_PRODUCT', 'Product', id, data as Prisma.InputJsonValue);
      return product;
    }
    if (action === 'approve') {
      const product = await prisma.product.update({ where: { id }, data: { isApproved: true, isAvailable: true } });
      await audit(adminId, 'APPROVE_PRODUCT', 'Product', id);
      return product;
    }
  }

  if (resource === 'categories') {
    if (action === 'create') {
      const cat = await prisma.category.create({
        data: {
          slug: slugify(String(data.slug || data.nameFr || 'categorie')),
          nameFr: String(data.nameFr ?? ''),
          nameNl: String(data.nameNl ?? data.nameFr ?? ''),
          nameDe: String(data.nameDe ?? data.nameFr ?? ''),
          nameEn: String(data.nameEn ?? data.nameFr ?? ''),
          icon: String(data.icon ?? '🧺'),
          color: String(data.color ?? '#529a3c'),
          vatRateBps: Number(data.vatRateBps ?? 600),
          sortOrder: Number(data.sortOrder ?? 99),
        },
      });
      await audit(adminId, 'CREATE_CATEGORY', 'Category', cat.id);
      return cat;
    }
    if (action === 'update' && id) {
      const cat = await prisma.category.update({
        where: { id },
        data: {
          ...(typeof data.nameFr === 'string' ? { nameFr: data.nameFr } : {}),
          ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
          ...(typeof data.sortOrder === 'number' ? { sortOrder: data.sortOrder } : {}),
          ...(typeof data.vatRateBps === 'number' ? { vatRateBps: data.vatRateBps } : {}),
        },
      });
      await audit(adminId, 'UPDATE_CATEGORY', 'Category', id);
      return cat;
    }
  }

  if (resource === 'orders') {
    if (!id) throw new HttpError(400, 'id requis.');
    if (action === 'status') {
      const status = data.status as OrderStatus;
      const order = await prisma.order.update({
        where: { id },
        data: { status },
      });
      await prisma.orderStatusHistory.create({
        data: {
          orderId: id,
          status,
          authorId: adminId,
          authorRole: 'ADMIN',
          note: String(data.note ?? 'Forcé par l’admin'),
        },
      });
      await audit(adminId, 'FORCE_ORDER_STATUS', 'Order', id, { status });
      return order;
    }
    if (action === 'cancel') {
      const order = await prisma.order.update({
        where: { id },
        data: { status: 'ANNULEE', cancelledAt: new Date(), cancelledBy: adminId, cancellationReason: String(data.reason ?? 'Admin') },
      });
      await prisma.orderStatusHistory.create({
        data: { orderId: id, status: 'ANNULEE', authorId: adminId, authorRole: 'ADMIN', note: String(data.reason ?? '') },
      });
      await audit(adminId, 'CANCEL_ORDER', 'Order', id);
      return order;
    }
    if (action === 'refund') {
      const order = await prisma.order.findUnique({ where: { id }, include: { payment: true } });
      if (!order?.payment) throw new HttpError(404, 'Paiement introuvable.');
      const amount = Number(data.amountCents ?? order.payment.amountCents - order.payment.refundedCents);
      if (integrations.stripe && order.payment.stripePaymentIntentId) {
        await refundPayment({
          paymentId: order.payment.id,
          amountCents: amount,
          reason: String(data.reason ?? 'Remboursement admin'),
          initiatedById: adminId,
        });
      } else {
        const newRefunded = order.payment.refundedCents + amount;
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            refundedCents: newRefunded,
            status: newRefunded >= order.payment.amountCents ? 'REMBOURSE' : 'REMBOURSE_PARTIEL',
          },
        });
        await prisma.order.update({
          where: { id },
          data: { paymentStatus: newRefunded >= order.payment.amountCents ? 'REMBOURSE' : 'REMBOURSE_PARTIEL' },
        });
      }
      await audit(adminId, 'REFUND_ORDER', 'Order', id, { amount });
      return { ok: true };
    }
  }

  if (resource === 'disputes') {
    if (!id) throw new HttpError(400, 'id requis.');
    if (action === 'update') {
      const dispute = await prisma.dispute.update({
        where: { id },
        data: {
          ...(typeof data.status === 'string' ? { status: data.status as DisputeStatus } : {}),
          ...(typeof data.resolution === 'string' ? { resolution: data.resolution, resolvedById: adminId, resolvedAt: new Date() } : {}),
        },
      });
      await audit(adminId, 'UPDATE_DISPUTE', 'Dispute', id, data as Prisma.InputJsonValue);
      return dispute;
    }
  }

  if (resource === 'reviews' && action === 'delete' && id) {
    await prisma.review.delete({ where: { id } });
    await audit(adminId, 'DELETE_REVIEW', 'Review', id);
    return { ok: true };
  }

  if (resource === 'payouts' && action === 'markPaid' && id) {
    const payout = await prisma.payout.update({ where: { id }, data: { status: 'VERSE', paidAt: new Date() } });
    await audit(adminId, 'MARK_PAYOUT_PAID', 'Payout', id);
    return payout;
  }

  if (resource === 'holidays' && action === 'create') {
    const holiday = await prisma.belgianHoliday.create({
      data: {
        date: new Date(String(data.date)),
        nameFr: String(data.nameFr ?? ''),
        nameNl: String(data.nameNl ?? data.nameFr ?? ''),
        nameDe: String(data.nameDe ?? data.nameFr ?? ''),
        nameEn: String(data.nameEn ?? data.nameFr ?? ''),
      },
    });
    await audit(adminId, 'CREATE_HOLIDAY', 'Holiday', holiday.id);
    return holiday;
  }

  if (resource === 'settings' && action === 'update') {
    const numericKeys = [
      'serviceFeeCents',
      'serviceFeeBps',
      'serviceFeeCapCents',
      'vendorCommissionBps',
      'minOrderCents',
      'deliveryBaseFeeCents',
      'deliveryPerKmCents',
      'deliveryFreeAboveCents',
      'deliveryMaxKm',
      'courierBaseFeeCents',
      'courierPerKmCents',
      'courierPerVendorCents',
      'courierMinEarningCents',
      'surgeMaxBps',
      'rainBonusCents',
      'highDemandBonusCents',
      'vatFoodBps',
      'vatServiceBps',
      'offerTimeoutSeconds',
      'initialSearchRadiusKm',
      'radiusIncrementKm',
      'maxSearchRadiusKm',
      'maxSearchWaves',
      'offersPerWave',
      'scheduledAssignLeadMinutes',
      'freeCancellationSeconds',
      'cancellationFeeCents',
    ] as const;
    const patch: Record<string, unknown> = { updatedById: adminId };
    for (const key of numericKeys) {
      if (typeof data[key] === 'number') patch[key] = data[key];
    }
    if (typeof data.surgeEnabled === 'boolean') patch.surgeEnabled = data.surgeEnabled;
    const settings = await prisma.platformSettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...patch },
      update: patch,
    });
    invalidateSettingsCache();
    await audit(adminId, 'UPDATE_SETTINGS', 'PlatformSettings', 'global', data as Prisma.InputJsonValue);
    return settings;
  }

  throw new HttpError(400, `Action ${action} non supportée pour ${resource}.`);
}
