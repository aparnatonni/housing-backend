import type { Prisma, Role } from "@prisma/client";
import config from "../../config";
import { AppError } from "../../errors";
import { sendMailToUser } from "../../lib/mailer";
import prisma from "../../lib/prisma";
import type { InitiatePaymentInput } from "./payments.validation";
import {
  initiateSslcommerzSession,
  type SslcommerzValidation,
} from "./sslcommerz.gateway";

const paymentSelect = {
  id: true,
  userId: true,
  amount: true,
  currency: true,
  purpose: true,
  gateway: true,
  gatewayTransactionId: true,
  status: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  rentPayments: { select: { id: true, status: true } },
  billSplits: { select: { id: true, status: true } },
} satisfies Prisma.PaymentSelect;

const paymentAccessSelect = {
  id: true,
  userId: true,
  rentPayments: {
    select: {
      tenancy: {
        select: {
          room: {
            select: {
              property: { select: { ownerId: true } },
            },
          },
        },
      },
    },
  },
  billSplits: {
    select: {
      tenancy: {
        select: {
          room: {
            select: {
              property: { select: { ownerId: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PaymentSelect;

type PaymentAccess = Prisma.PaymentGetPayload<{
  select: typeof paymentAccessSelect;
}>;

type PaymentUser = {
  name: string;
  email: string;
  phone: string | null;
};

type ActiveTenancyPayload = {
  status: "ACTIVE";
  tenantId: string;
  room: {
    id: string;
    deletedAt: null;
    property: { deletedAt: null; ownerId: string };
  };
};

const loadActiveTenancy = (tenancy: unknown): ActiveTenancyPayload => {
  const payload = tenancy as ActiveTenancyPayload;
  if (
    payload?.status !== "ACTIVE" ||
    payload.room.deletedAt !== null ||
    payload.room.property.deletedAt !== null
  ) {
    throw new AppError("Active tenancy not found", 404);
  }
  return payload;
};

const assertHasAccess = (
  userId: string,
  role: Role,
  payment: PaymentAccess,
): void => {
  if (role === "ADMIN" || payment.userId === userId) {
    return;
  }
  if (role === "OWNER") {
    const ownerIds = [
      ...payment.rentPayments.map(
        (payment) => payment.tenancy.room.property.ownerId,
      ),
      ...payment.billSplits.map(
        (payment) => payment.tenancy.room.property.ownerId,
      ),
    ];
    if (ownerIds.includes(userId)) {
      return;
    }
  }
  throw new AppError("You do not have permission to access this payment", 403);
};

const mergeValidationMetadata = (
  current: Prisma.JsonValue | null | undefined,
  validate: SslcommerzValidation,
): Prisma.InputJsonValue => {
  const base =
    current !== null && typeof current === "object" && !Array.isArray(current)
      ? current
      : {};
  const currentSslcommerz =
    typeof base.sslcommerz === "object" &&
    base.sslcommerz !== null &&
    !Array.isArray(base.sslcommerz)
      ? base.sslcommerz
      : {};
  return {
    ...base,
    sslcommerz: { ...currentSslcommerz, validate },
  } as Prisma.InputJsonValue;
};

const mergeFailureMetadata = (
  current: Prisma.JsonValue | null | undefined,
  reason: string,
): Prisma.InputJsonValue => {
  const base =
    current !== null && typeof current === "object" && !Array.isArray(current)
      ? current
      : {};
  const currentSslcommerz =
    typeof base.sslcommerz === "object" &&
    base.sslcommerz !== null &&
    !Array.isArray(base.sslcommerz)
      ? base.sslcommerz
      : {};
  return {
    ...base,
    sslcommerz: {
      ...currentSslcommerz,
      failedAt: new Date().toISOString(),
      failedReason: reason,
    },
  } as Prisma.InputJsonValue;
};

const runGatewaySession = async (
  paymentId: string,
  amount: number,
  user: PaymentUser,
  productName: string,
) => {
  const session = await initiateSslcommerzSession({
    tranId: paymentId,
    amount,
    currency: "BDT",
    customerName: user.name,
    customerEmail: user.email,
    customerMobile: user.phone ?? "00000000000",
    successUrl: config.sslcommerz.successUrl,
    failUrl: config.sslcommerz.failUrl,
    cancelUrl: config.sslcommerz.cancelUrl,
    ipnUrl: config.sslcommerz.ipnUrl,
    productName,
  });

  if (!session.ok) {
    await failPayment(paymentId, session.error);
    throw new AppError(`Unable to initialize payment: ${session.error}`, 502);
  }

  const update = await prisma.payment.update({
    where: { id: paymentId },
    data: { metadata: { sslcommerz: { session: session.data } } },
    select: paymentSelect,
  });

  return {
    payment: update,
    gatewayPageURL: session.data.GatewayPageURL ?? null,
    sessionKey: session.data.sessionkey ?? null,
  };
};

export const initiatePayment = async (
  userId: string,
  input: InitiatePaymentInput,
) => {
  if (!config.sslcommerz.storeId || !config.sslcommerz.storePassword) {
    throw new AppError("SSLCommerz is not configured", 503);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (input.type === "RENT") {
    return initiateRentPayment(userId, user, input.referenceId);
  }
  return initiateBillSplitPayment(userId, user, input.referenceId);
};

const initiateRentPayment = async (
  userId: string,
  user: PaymentUser,
  rentPaymentId: string,
) => {
  const rentPayment = await prisma.rentPayment.findUnique({
    where: { id: rentPaymentId },
    select: {
      id: true,
      amount: true,
      status: true,
      paidAt: true,
      paymentId: true,
      tenancy: {
        select: {
          status: true,
          tenantId: true,
          room: {
            select: {
              id: true,
              deletedAt: true,
              property: { select: { deletedAt: true, ownerId: true } },
            },
          },
        },
      },
    },
  });
  if (!rentPayment) {
    throw new AppError("Rent payment not found", 404);
  }
  const tenancy = loadActiveTenancy(rentPayment.tenancy);
  if (tenancy.tenantId !== userId) {
    throw new AppError(
      "You do not have permission to pay this rent payment",
      403,
    );
  }
  if (rentPayment.status !== "PENDING" || rentPayment.paidAt !== null) {
    throw new AppError("Rent payment has already been processed", 409);
  }
  if (rentPayment.paymentId) {
    throw new AppError(
      "A payment is already in progress for this rent payment",
      409,
    );
  }

  const payment = await prisma.$transaction(
    async (tx) => {
      const created = await tx.payment.create({
        data: {
          userId,
          amount: rentPayment.amount,
          currency: "BDT",
          purpose: "RENT",
          gateway: "SSLCOMMERZ",
          status: "PENDING",
          metadata: { sslcommerz: {} },
        },
        select: paymentSelect,
      });
      await tx.rentPayment.update({
        where: { id: rentPayment.id },
        data: { paymentId: created.id },
      });
      return created;
    },
    { timeout: 30_000 },
  );

  return runGatewaySession(payment.id, payment.amount, user, "Rent payment");
};

const initiateBillSplitPayment = async (
  userId: string,
  user: PaymentUser,
  billSplitId: string,
) => {
  const billSplit = await prisma.billSplit.findUnique({
    where: { id: billSplitId },
    select: {
      id: true,
      status: true,
      paidAt: true,
      paymentId: true,
      tenancy: {
        select: {
          status: true,
          room: {
            select: {
              id: true,
              deletedAt: true,
              property: { select: { deletedAt: true, ownerId: true } },
            },
          },
        },
      },
      shares: {
        where: { tenantId: userId },
        select: { id: true, shareAmount: true, isPaid: true },
      },
    },
  });
  if (!billSplit) {
    throw new AppError("Bill split not found", 404);
  }
  loadActiveTenancy(billSplit.tenancy);

  const share = billSplit.shares[0];
  if (!share) {
    throw new AppError("You do not have a share in this bill split", 403);
  }
  if (share.isPaid) {
    throw new AppError(
      "Your share in this bill split has already been paid",
      409,
    );
  }
  if (billSplit.paymentId) {
    throw new AppError(
      "A payment is already in progress for this bill split",
      409,
    );
  }

  const payment = await prisma.$transaction(
    async (tx) => {
      const created = await tx.payment.create({
        data: {
          userId,
          amount: share.shareAmount,
          currency: "BDT",
          purpose: "BILL",
          gateway: "SSLCOMMERZ",
          status: "PENDING",
          metadata: { sslcommerz: {} },
        },
        select: paymentSelect,
      });
      await tx.billSplit.update({
        where: { id: billSplit.id },
        data: { paymentId: created.id },
      });
      return created;
    },
    { timeout: 30_000 },
  );

  return runGatewaySession(payment.id, payment.amount, user, "Bill payment");
};

export const finalizePaymentAfterVerification = async (
  tranId: string,
  verification: { valId: string; validate: SslcommerzValidation },
) => {
  const { payment, shouldEmail } = await prisma.$transaction(
    async (tx) => {
      let shouldEmail = false;
      const payment = await tx.payment.findUnique({
        where: { id: tranId },
        select: paymentSelect,
      });
      if (!payment) {
        throw new AppError("Payment not found", 404);
      }
      if (payment.status === "SUCCESS") {
        return { payment, shouldEmail };
      }

      const reportedAmount = Number(verification.validate.amount);
      const reportedCurrency = String(verification.validate.currency ?? "");
      if (
        Number.isFinite(reportedAmount) &&
        Math.abs(reportedAmount - payment.amount) > 0.01
      ) {
        throw new AppError(
          "Gateway reported a different amount for this payment",
          400,
        );
      }
      if (reportedCurrency !== "" && reportedCurrency !== "BDT") {
        throw new AppError(
          "Gateway reported a different currency for this payment",
          400,
        );
      }

      const claim = await tx.payment.updateMany({
        where: { id: tranId, status: "PENDING" },
        data: {
          status: "SUCCESS",
          gatewayTransactionId: verification.valId,
          metadata: mergeValidationMetadata(
            payment.metadata,
            verification.validate,
          ),
        },
      });
      if (claim.count === 0) {
        const current = await tx.payment.findUnique({
          where: { id: tranId },
          select: paymentSelect,
        });
        if (current?.status === "SUCCESS") {
          return { payment: current, shouldEmail };
        }
        throw new AppError("Payment cannot be processed", 409);
      }
      shouldEmail = true;

      if (payment.purpose === "RENT") {
        const rentPayment = await tx.rentPayment.findFirst({
          where: { paymentId: tranId },
          select: { id: true, amount: true },
        });
        if (rentPayment) {
          await tx.rentPayment.update({
            where: { id: rentPayment.id },
            data: { status: "PAID", paidAt: new Date() },
          });
          await tx.notification.create({
            data: {
              userId: payment.userId,
              type: "PAYMENT_SUCCEEDED",
              message: `Your rent payment of $${rentPayment.amount.toFixed(2)} was successful.`,
            },
          });
          await tx.auditLog.create({
            data: {
              userId: payment.userId,
              action: "PAYMENT_SUCCEEDED",
              entityType: "RentPayment",
              entityId: rentPayment.id,
              metadata: {
                gateway: "SSLCOMMERZ",
                gatewayTransactionId: verification.valId,
                amount: payment.amount,
              },
            },
          });
        }
      } else if (payment.purpose === "BILL") {
        const billSplit = await tx.billSplit.findFirst({
          where: { paymentId: tranId },
          select: { id: true, totalAmount: true },
        });
        if (billSplit) {
          await tx.billSplitTenant.updateMany({
            where: {
              billSplitId: billSplit.id,
              tenantId: payment.userId,
              isPaid: false,
            },
            data: { isPaid: true, paidAt: new Date() },
          });
          const [totalShares, paidShares] = await Promise.all([
            tx.billSplitTenant.count({
              where: { billSplitId: billSplit.id },
            }),
            tx.billSplitTenant.count({
              where: { billSplitId: billSplit.id, isPaid: true },
            }),
          ]);
          if (totalShares === paidShares) {
            await tx.billSplit.update({
              where: { id: billSplit.id },
              data: { status: "PAID", paidAt: new Date() },
            });
          }
          const share = await tx.billSplitTenant.findFirst({
            where: { billSplitId: billSplit.id, tenantId: payment.userId },
            select: { shareAmount: true },
          });
          await tx.notification.create({
            data: {
              userId: payment.userId,
              type: "PAYMENT_SUCCEEDED",
              message: `Your bill payment of $${(share?.shareAmount ?? payment.amount).toFixed(2)} was successful.`,
            },
          });
          await tx.auditLog.create({
            data: {
              userId: payment.userId,
              action: "PAYMENT_SUCCEEDED",
              entityType: "BillSplit",
              entityId: billSplit.id,
              metadata: {
                gateway: "SSLCOMMERZ",
                gatewayTransactionId: verification.valId,
                amount: payment.amount,
              },
            },
          });
        }
      }

      return {
        payment: await tx.payment.findUniqueOrThrow({
          where: { id: tranId },
          select: paymentSelect,
        }),
        shouldEmail,
      };
    },
    { timeout: 30_000 },
  );

  if (shouldEmail) {
    const amount = payment.amount.toFixed(2);
    await sendMailToUser(
      payment.userId,
      "Payment successful",
      payment.purpose === "RENT"
        ? `Your rent payment of $${amount} was successful.`
        : `Your bill payment of $${amount} was successful.`,
    );
  }

  return payment;
};

export const failPayment = async (
  tranId: string,
  reason = "Payment failed",
) => {
  return prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: tranId },
        select: { id: true, status: true, purpose: true, metadata: true },
      });
      if (!payment) {
        throw new AppError("Payment not found", 404);
      }
      if (payment.status === "FAILED") {
        return tx.payment.findUniqueOrThrow({
          where: { id: tranId },
          select: paymentSelect,
        });
      }
      if (payment.status === "SUCCESS") {
        throw new AppError("Payment has already succeeded", 409);
      }

      const claim = await tx.payment.updateMany({
        where: { id: tranId, status: "PENDING" },
        data: {
          status: "FAILED",
          metadata: mergeFailureMetadata(payment.metadata, reason),
        },
      });
      if (claim.count === 0) {
        throw new AppError("Payment cannot be processed", 409);
      }

      if (payment.purpose === "RENT") {
        await tx.rentPayment.updateMany({
          where: { paymentId: tranId },
          data: { paymentId: null },
        });
      } else if (payment.purpose === "BILL") {
        await tx.billSplit.updateMany({
          where: { paymentId: tranId },
          data: { paymentId: null },
        });
      }

      return tx.payment.findUniqueOrThrow({
        where: { id: tranId },
        select: paymentSelect,
      });
    },
    { timeout: 30_000 },
  );
};

export const getPayment = async (
  userId: string,
  role: Role,
  paymentId: string,
) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: paymentAccessSelect,
  });
  if (!payment) {
    throw new AppError("Payment not found", 404);
  }
  assertHasAccess(userId, role, payment);

  return prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: paymentSelect,
  });
};

export const listMyPayments = async (
  userId: string,
  page: number,
  limit: number,
) => {
  const where: Prisma.PaymentWhereInput = { userId };
  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      select: paymentSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
    },
  };
};
