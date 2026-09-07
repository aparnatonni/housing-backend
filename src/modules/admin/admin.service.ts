import type { Prisma } from "@prisma/client";
import { AppError } from "../../errors";
import { invalidatePropertyLists } from "../../lib/cache";
import prisma from "../../lib/prisma";
import type {
  ListAuditLogsQuery,
  ListPaymentsAdminQuery,
} from "./admin.validation";

const startOfMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const startOfNextMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

const buildMeta = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
});

export const getDashboardStats = async () => {
  const now = new Date();
  const monthFrom = startOfMonth(now);
  const monthTo = startOfNextMonth(now);

  const [
    usersByRole,
    totalUsers,
    totalProperties,
    activeProperties,
    inactiveProperties,
    totalRooms,
    availableRooms,
    totalTenancies,
    activeTenancies,
    pendingApplications,
    pendingViewings,
    openMaintenance,
    inProgressMaintenance,
    closedMaintenance,
    totalMaintenance,
    paymentsThisMonth,
    successfulPaymentsThisMonth,
    totalSuccessfulPayments,
    pendingRentPayments,
    overdueRentPayments,
    pendingBillSplits,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.property.count({ where: { deletedAt: null } }),
    prisma.property.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.property.count({ where: { deletedAt: null, status: "INACTIVE" } }),
    prisma.room.count({ where: { deletedAt: null } }),
    prisma.room.count({ where: { deletedAt: null, isAvailable: true } }),
    prisma.tenancy.count(),
    prisma.tenancy.count({ where: { status: "ACTIVE" } }),
    prisma.application.count({ where: { status: "PENDING" } }),
    prisma.viewingRequest.count({ where: { status: "PENDING" } }),
    prisma.maintenanceRequest.count({ where: { status: "OPEN" } }),
    prisma.maintenanceRequest.count({ where: { status: "IN_PROGRESS" } }),
    prisma.maintenanceRequest.count({ where: { status: "CLOSED" } }),
    prisma.maintenanceRequest.count(),
    prisma.payment.aggregate({
      where: { createdAt: { gte: monthFrom, lt: monthTo } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: monthFrom, lt: monthTo }, status: "SUCCESS" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.rentPayment.count({ where: { status: "PENDING" } }),
    prisma.rentPayment.count({ where: { status: "OVERDUE" } }),
    prisma.billSplit.count({ where: { status: "PENDING" } }),
  ]);

  const roleCounts: Record<string, number> = {};
  for (const entry of usersByRole) {
    roleCounts[entry.role] = entry._count._all;
  }

  return {
    users: {
      total: totalUsers,
      byRole: {
        TENANT: roleCounts.TENANT ?? 0,
        OWNER: roleCounts.OWNER ?? 0,
        ADMIN: roleCounts.ADMIN ?? 0,
      },
    },
    properties: {
      total: totalProperties,
      active: activeProperties,
      inactive: inactiveProperties,
    },
    rooms: { total: totalRooms, available: availableRooms },
    tenancies: { total: totalTenancies, active: activeTenancies },
    applications: { pending: pendingApplications },
    viewingRequests: { pending: pendingViewings },
    maintenanceRequests: {
      total: totalMaintenance,
      open: openMaintenance,
      inProgress: inProgressMaintenance,
      closed: closedMaintenance,
    },
    payments: {
      totalThisMonth: paymentsThisMonth._count._all,
      amountThisMonth: paymentsThisMonth._sum.amount ?? 0,
      successfulThisMonth: successfulPaymentsThisMonth._count._all,
      successfulAmountThisMonth: successfulPaymentsThisMonth._sum.amount ?? 0,
      totalSuccessful: totalSuccessfulPayments._count._all,
      totalSuccessfulAmount: totalSuccessfulPayments._sum.amount ?? 0,
    },
    rentPayments: {
      pending: pendingRentPayments,
      overdue: overdueRentPayments,
    },
    billSplits: { pending: pendingBillSplits },
  };
};

export const listAuditLogs = async (input: ListAuditLogsQuery) => {
  const where: Prisma.AuditLogWhereInput = {
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.to ? { lte: new Date(input.to) } : {}),
          },
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
  ]);

  return { items, meta: buildMeta(total, input.page, input.limit) };
};

export const updatePropertyStatus = async (
  propertyId: string,
  status: "ACTIVE" | "INACTIVE",
) => {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, title: true, deletedAt: true },
  });
  if (!property || property.deletedAt !== null) {
    throw new AppError("Property not found", 404);
  }

  const updated = await prisma.property.update({
    where: { id: propertyId },
    data: { status },
    select: {
      id: true,
      title: true,
      description: true,
      address: true,
      city: true,
      area: true,
      state: true,
      zipCode: true,
      propertyType: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  await invalidatePropertyLists();
  return updated;
};

export const listAllPayments = async (input: ListPaymentsAdminQuery) => {
  const where: Prisma.PaymentWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.gateway ? { gateway: input.gateway } : {}),
    ...(input.purpose ? { purpose: input.purpose } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        purpose: true,
        gateway: true,
        gatewayTransactionId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
        rentPayments: { select: { id: true, status: true } },
        billSplits: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
  ]);

  return { items, meta: buildMeta(total, input.page, input.limit) };
};
