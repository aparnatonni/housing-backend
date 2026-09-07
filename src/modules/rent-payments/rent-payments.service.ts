import type { Prisma, Role } from "@prisma/client";
import { AppError } from "../../errors";
import prisma from "../../lib/prisma";
import type { GenerateRentPaymentInput } from "./rent-payments.validation";

const rentPaymentSelect = {
  id: true,
  amount: true,
  dueDate: true,
  paidAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  paymentId: true,
} satisfies Prisma.RentPaymentSelect;

type TenancyWithRoom = Prisma.TenancyGetPayload<{
  select: {
    id: true;
    status: true;
    rentAmount: true;
    startDate: true;
    tenantId: true;
    room: {
      select: {
        id: true;
        deletedAt: true;
        property: { select: { id: true; ownerId: true; deletedAt: true } };
      };
    };
  };
}>;

const loadTenancy = async (tenancyId: string): Promise<TenancyWithRoom> => {
  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    select: {
      id: true,
      status: true,
      rentAmount: true,
      startDate: true,
      tenantId: true,
      room: {
        select: {
          id: true,
          deletedAt: true,
          property: {
            select: { id: true, ownerId: true, deletedAt: true },
          },
        },
      },
    },
  });
  if (
    tenancy?.status !== "ACTIVE" ||
    tenancy.room.deletedAt !== null ||
    tenancy.room.property.deletedAt !== null
  ) {
    throw new AppError("Active tenancy not found", 404);
  }
  return tenancy;
};

const authorizeTenancyAccess = (
  userId: string,
  role: Role,
  tenancy: TenancyWithRoom,
): void => {
  const tenantAccess = role === "TENANT" && tenancy.tenantId === userId;
  const ownerAccess =
    role === "OWNER" && tenancy.room.property.ownerId === userId;
  if (!tenantAccess && !ownerAccess) {
    throw new AppError(
      "You do not have permission to access this tenancy",
      403,
    );
  }
};

const startOfNextMonth = (date: Date): Date => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return new Date(Date.UTC(year, month, 1));
};

const monthStart = (date: Date): Date => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month, 1));
};

const addOnePeriod = (date: Date): Date => {
  const start = monthStart(date);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
};

const nextMonthlyDueDate = (from: Date): Date => {
  const day = Math.min(from.getUTCDate(), 28);
  const start = startOfNextMonth(from);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day));
};

const nextPaymentDueDate = async (tenancy: TenancyWithRoom): Promise<Date> => {
  const lastPayment = await prisma.rentPayment.findFirst({
    where: { tenancyId: tenancy.id },
    orderBy: { dueDate: "desc" },
    select: { dueDate: true },
  });
  return lastPayment
    ? nextMonthlyDueDate(lastPayment.dueDate)
    : new Date(tenancy.startDate);
};

export const listRentPayments = async (
  userId: string,
  role: Role,
  tenancyId: string,
) => {
  const tenancy = await loadTenancy(tenancyId);
  authorizeTenancyAccess(userId, role, tenancy);

  const items = await prisma.rentPayment.findMany({
    where: { tenancyId },
    select: rentPaymentSelect,
    orderBy: { dueDate: "desc" },
  });

  const now = new Date();
  return {
    history: items.filter(
      (payment) => payment.dueDate.getTime() <= now.getTime(),
    ),
    upcoming: items.filter(
      (payment) => payment.dueDate.getTime() > now.getTime(),
    ),
  };
};

export const generateRentPayment = async (
  ownerId: string,
  tenancyId: string,
  input: GenerateRentPaymentInput,
) => {
  const tenancy = await loadTenancy(tenancyId);
  if (tenancy.room.property.ownerId !== ownerId) {
    throw new AppError(
      "You do not have permission to generate rent payments for this tenancy",
      403,
    );
  }

  const dueDate = input.dueDate
    ? new Date(input.dueDate)
    : await nextPaymentDueDate(tenancy);
  if (Number.isNaN(dueDate.getTime())) {
    throw new AppError("dueDate must be a valid date", 400);
  }

  const periodStart = monthStart(dueDate);
  const existing = await prisma.rentPayment.findFirst({
    where: {
      tenancyId,
      dueDate: { gte: periodStart, lt: addOnePeriod(periodStart) },
    },
    select: { id: true },
  });
  if (existing) {
    throw new AppError("A rent payment already exists for this month", 409);
  }

  const payment = await prisma.rentPayment.create({
    data: {
      tenancyId,
      amount: tenancy.rentAmount,
      dueDate,
      status: "PENDING",
    },
    select: rentPaymentSelect,
  });

  await prisma.notification.create({
    data: {
      userId: tenancy.tenantId,
      type: "RENT_PAYMENT_DUE",
      message: `Rent of $${tenancy.rentAmount.toFixed(2)} is due on ${dueDate.toISOString().slice(0, 10)}.`,
    },
  });

  return payment;
};

export const markRentPaymentPaid = async (rentPaymentId: string) => {
  const claim = await prisma.rentPayment.updateMany({
    where: { id: rentPaymentId },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (claim.count === 0) {
    const existingPayment = await prisma.rentPayment.findUnique({
      where: { id: rentPaymentId },
      select: { id: true },
    });
    if (!existingPayment) {
      throw new AppError("Rent payment not found", 404);
    }
    throw new AppError("Rent payment has already been processed", 409);
  }

  return prisma.rentPayment.findUniqueOrThrow({
    where: { id: rentPaymentId },
    select: rentPaymentSelect,
  });
};
