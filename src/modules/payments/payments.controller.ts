import type { Request, Response } from "express";
import { AppError } from "../../errors";
import { requireUUID, sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import {
  failPayment,
  finalizePaymentAfterVerification,
  getPayment,
  initiatePayment,
  listMyPayments,
} from "./payments.service";
import {
  initiatePaymentSchema,
  listMyPaymentsQuerySchema,
} from "./payments.validation";
import { validateSslcommerzTransaction } from "./sslcommerz.gateway";

const requireUser = (req: Request): NonNullable<typeof req.user> => {
  const user = req.user;
  if (!user) {
    throw new AppError("Authentication token is required", 401);
  }
  return user;
};

const extractCallbackParams = (req: Request): Record<string, unknown> => ({
  ...(req.query as Record<string, unknown>),
  ...(req.body as Record<string, unknown>),
});

const firstString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const isValidValidationStatus = (status: string): boolean =>
  status === "VALID" || status === "VALIDATED";

export const initiate = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(initiatePaymentSchema, req.body ?? {});
  const user = requireUser(req);
  const result = await initiatePayment(user.id, input);
  sendSuccess(res, {
    message: "Payment checkout initialized successfully",
    data: result,
  });
};

export const success = async (req: Request, res: Response): Promise<void> => {
  const params = extractCallbackParams(req);
  const valId = firstString(params.val_id);
  if (!valId) {
    throw new AppError("Payment callback is missing val_id", 400);
  }

  const verification = await validateSslcommerzTransaction(valId);
  if (!verification.ok) {
    throw new AppError(
      `Payment validation with the gateway failed: ${verification.error}`,
      502,
    );
  }

  const status = String(verification.data.status ?? "");
  if (!isValidValidationStatus(status)) {
    const tranId = firstString(verification.data.tran_id);
    if (tranId) {
      try {
        await failPayment(tranId, `Gateway status: ${status}`);
      } catch (error) {
        void error;
      }
    }
    throw new AppError("Payment could not be validated by the gateway", 400);
  }

  const tranId = firstString(verification.data.tran_id);
  if (!tranId) {
    throw new AppError("Gateway response is missing tran_id", 400);
  }

  const payment = await finalizePaymentAfterVerification(tranId, {
    valId,
    validate: verification.data,
  });
  sendSuccess(res, {
    message: "Payment confirmed successfully",
    data: payment,
  });
};

export const fail = async (req: Request, res: Response): Promise<void> => {
  const params = extractCallbackParams(req);
  const tranId = firstString(params.tran_id);
  if (!tranId) {
    throw new AppError("Payment callback is missing tran_id", 400);
  }
  const payment = await failPayment(tranId, "Payment was not completed");
  sendSuccess(res, {
    message: "Payment marked as failed",
    data: payment,
  });
};

export const cancel = async (req: Request, res: Response): Promise<void> => {
  const params = extractCallbackParams(req);
  const tranId = firstString(params.tran_id);
  if (!tranId) {
    throw new AppError("Payment callback is missing tran_id", 400);
  }
  const payment = await failPayment(
    tranId,
    "Payment was cancelled by the user",
  );
  sendSuccess(res, {
    message: "Payment marked as cancelled",
    data: payment,
  });
};

export const webhook = async (req: Request, res: Response): Promise<void> => {
  const params = extractCallbackParams(req);
  const status = String(params.status ?? "");
  const valId = firstString(params.val_id);
  const tranId = firstString(params.tran_id);

  if (isValidValidationStatus(status)) {
    if (!valId) {
      throw new AppError("IPN callback is missing val_id", 400);
    }
    const verification = await validateSslcommerzTransaction(valId);
    if (!verification.ok) {
      throw new AppError(
        `Payment validation with the gateway failed: ${verification.error}`,
        502,
      );
    }
    const verifiedStatus = String(verification.data.status ?? "");
    if (!isValidValidationStatus(verifiedStatus)) {
      const failTranId = firstString(verification.data.tran_id) ?? tranId;
      if (failTranId) {
        await failPayment(
          failTranId,
          `IPN validation status: ${verifiedStatus}`,
        );
      }
      throw new AppError("Payment could not be validated by the gateway", 400);
    }
    const verifiedTranId = firstString(verification.data.tran_id) ?? tranId;
    if (!verifiedTranId) {
      throw new AppError("Gateway response is missing tran_id", 400);
    }
    const payment = await finalizePaymentAfterVerification(verifiedTranId, {
      valId,
      validate: verification.data,
    });
    sendSuccess(res, {
      message: "IPN processed",
      data: { received: true, paymentId: payment.id },
    });
    return;
  }

  if (!tranId) {
    throw new AppError("IPN callback is missing tran_id", 400);
  }
  await failPayment(tranId, `IPN status: ${status || "unknown"}`);
  sendSuccess(res, {
    message: "IPN processed",
    data: { received: true, paymentId: tranId },
  });
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  const paymentId = requireUUID(String(req.params.id), "payment id");
  const user = requireUser(req);
  const payment = await getPayment(user.id, user.role, paymentId);
  sendSuccess(res, {
    message: "Payment fetched successfully",
    data: payment,
  });
};

export const myPayments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = validateBody(listMyPaymentsQuerySchema, req.query ?? {});
  const user = requireUser(req);
  const result = await listMyPayments(user.id, query.page, query.limit);
  sendSuccess(res, {
    message: "Payments fetched successfully",
    data: result,
  });
};
