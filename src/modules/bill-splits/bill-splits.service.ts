import type { Prisma, Role } from "@prisma/client";
import { AppError } from "../../errors";
import prisma from "../../lib/prisma";
import type { CreateBillSplitInput } from "./bill-splits.validation";

const billSplitSelect = {
  id: true,
  billType: true,
  totalAmount: true,
  dueDate: true,
  paidAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  shares: {
    select: {
      id: true,
      tenantId: true,
      shareAmount: true,
      isPaid: true,
      paidAt: true,
      tenant: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  },
} satisfies Prisma.BillSplitSelect;

const billSplitShareSelect = {
  id: true,
  billSplitId: true,
  tenantId: true,
  shareAmount: true,
  isPaid: true,
  paidAt: true,
  billSplit: {
    select: {
      id: true,
      billType: true,
      totalAmount: true,
      dueDate: true,
      status: true,
      paidAt: true,
      tenancyId: true,
      tenancy: {
        select: { id: true, roomId: true, tenantId: true },
      },
    },
  },
} satisfies Prisma.BillSplitTenantSelect;

type TenancyWithRoom = Prisma.TenancyGetPayload<{
  select: {
    id: true;
    status: true;
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

const roomTenants = async (tenancy: TenancyWithRoom): Promise<string[]> => {
  const tenants = await prisma.tenancy.findMany({
    where: { roomId: tenancy.room.id, status: "ACTIVE" },
    select: { tenantId: true },
  });
  return tenants.map((tenancy) => tenancy.tenantId);
};

const toCents = (amount: number): number => Math.round(amount * 100);

const ratioSplits = (totalAmount: number, ratio: number[]): number[] => {
  const totalCents = toCents(totalAmount);
  const ratioSum = ratio.reduce((sum, value) => sum + value, 0);
  if (ratioSum <= 0) {
    throw new AppError("Ratios must sum to a positive value", 400);
  }

  const rawCents = ratio.map((value) =>
    Math.floor((value / ratioSum) * totalCents),
  );
  let allocated = rawCents.reduce((sum, value) => sum + value, 0);
  let index = 0;
  while (allocated < totalCents) {
    rawCents[index % rawCents.length] += 1;
    allocated += 1;
    index += 1;
  }
  return rawCents.map((cents) => cents / 100);
};

const evenSplits = (totalAmount: number, count: number): number[] => {
  if (count <= 0) {
    throw new AppError("No tenants to split the bill with", 400);
  }
  return ratioSplits(totalAmount, Array<number>(count).fill(1));
};

const sumAmounts = (amounts: number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0);

const validateSum = (shares: number[], totalAmount: number): void => {
  const diff = Math.abs(sumAmounts(shares) - totalAmount);
  if (diff > 0.01) {
    throw new AppError("Bill splits must sum to the total amount", 400);
  }
};

type ShareInput = { tenantId: string; amount: number };

const buildShares = async (
  tenancy: TenancyWithRoom,
  input: CreateBillSplitInput,
): Promise<ShareInput[]> => {
  const tenantIds = await roomTenants(tenancy);

  if (input.shares) {
    const shareTenantIds = input.shares.map((share) => share.tenantId);
    if (new Set(shareTenantIds).size !== shareTenantIds.length) {
      throw new AppError("Duplicate tenant shares are not allowed", 400);
    }

    const requiredTenantIds = new Set(shareTenantIds);
    requiredTenantIds.add(tenancy.tenantId);
    const activeCount = await prisma.tenancy.count({
      where: {
        status: "ACTIVE",
        tenantId: { in: [...requiredTenantIds] },
      },
    });
    if (activeCount !== requiredTenantIds.size) {
      throw new AppError("All share recipients must be active tenants", 400);
    }

    validateSum(
      input.shares.map((share) => share.amount),
      input.totalAmount,
    );
    return input.shares.map((share) => ({
      tenantId: share.tenantId,
      amount: share.amount,
    }));
  }

  const ratio = input.ratio;
  if (ratio) {
    if (ratio.length !== tenantIds.length) {
      throw new AppError(
        `This room has ${tenantIds.length} active tenant(s); provide a ratio for each or use an even split`,
        400,
      );
    }
    return tenantIds.map((tenantId, index) => ({
      tenantId,
      amount: ratioSplits(input.totalAmount, ratio)[index],
    }));
  }

  const amounts = evenSplits(input.totalAmount, tenantIds.length);
  return tenantIds.map((tenantId, index) => ({
    tenantId,
    amount: amounts[index],
  }));
};

export const createBillSplit = async (
  userId: string,
  role: Role,
  input: CreateBillSplitInput,
) => {
  const tenancy = await loadTenancy(input.tenancyId);
  authorizeTenancyAccess(userId, role, tenancy);

  const shares = await buildShares(tenancy, input);

  const bill = await prisma.$transaction(
    async (tx) => {
      const created = await tx.billSplit.create({
        data: {
          tenancyId: tenancy.id,
          billType: input.billType,
          totalAmount: input.totalAmount,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          status: "PENDING",
          shares: {
            create: shares.map((share) => ({
              tenantId: share.tenantId,
              shareAmount: share.amount,
            })),
          },
        },
        select: billSplitSelect,
      });

      await tx.notification.createMany({
        data: shares.map((share) => ({
          userId: share.tenantId,
          type: "BILL_SPLIT_CREATED",
          message: `A ${input.billType} bill of $${input.totalAmount.toFixed(2)} has been split. Your share is $${share.amount.toFixed(2)}.`,
        })),
      });

      return created;
    },
    { timeout: 30_000 },
  );

  return bill;
};

export const listBillSplitsByTenancy = async (
  userId: string,
  role: Role,
  tenancyId: string,
) => {
  const tenancy = await loadTenancy(tenancyId);
  authorizeTenancyAccess(userId, role, tenancy);

  return prisma.billSplit.findMany({
    where: { tenancyId },
    select: billSplitSelect,
    orderBy: { createdAt: "desc" },
  });
};

export const settleShare = async (userId: string, shareId: string) => {
  return prisma.$transaction(
    async (tx) => {
      const claim = await tx.billSplitTenant.updateMany({
        where: { id: shareId, isPaid: false },
        data: { isPaid: true, paidAt: new Date() },
      });
      if (claim.count === 0) {
        throw new AppError("Share already settled or not found", 409);
      }

      const share = await tx.billSplitTenant.findUniqueOrThrow({
        where: { id: shareId },
        select: billSplitShareSelect,
      });

      if (share.tenantId !== userId) {
        throw new AppError(
          "You do not have permission to settle this share",
          403,
        );
      }

      const billId = share.billSplitId;
      const [totalShares, paidShares] = await Promise.all([
        tx.billSplitTenant.count({ where: { billSplitId: billId } }),
        tx.billSplitTenant.count({
          where: { billSplitId: billId, isPaid: true },
        }),
      ]);

      const billingUpdated = totalShares === paidShares;

      return {
        share,
        bill:
          billingUpdated === true
            ? await tx.billSplit.update({
                where: { id: billId },
                data: { status: "PAID", paidAt: new Date() },
                select: billSplitSelect,
              })
            : null,
      };
    },
    { timeout: 30_000 },
  );
};
