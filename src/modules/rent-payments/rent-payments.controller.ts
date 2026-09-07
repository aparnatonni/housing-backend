import type { Request, Response } from "express";
import { AppError } from "../../errors";
import { requireUUID, sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import {
  generateRentPayment,
  listRentPayments,
  markRentPaymentPaid,
} from "./rent-payments.service";
import { generateRentPaymentSchema } from "./rent-payments.validation";

const requireUser = (req: Request): NonNullable<typeof req.user> => {
  const user = req.user;
  if (!user) {
    throw new AppError("Authentication token is required", 401);
  }
  return user;
};

export const list = async (req: Request, res: Response): Promise<void> => {
  const tenancyId = requireUUID(String(req.params.tenancyId), "tenancy id");
  const user = requireUser(req);
  const result = await listRentPayments(user.id, user.role, tenancyId);
  sendSuccess(res, {
    message: "Rent payments fetched successfully",
    data: result,
  });
};

export const generate = async (req: Request, res: Response): Promise<void> => {
  const tenancyId = requireUUID(String(req.params.tenancyId), "tenancy id");
  const input = validateBody(generateRentPaymentSchema, req.body ?? {});
  const user = requireUser(req);
  const payment = await generateRentPayment(user.id, tenancyId, input);
  sendSuccess(
    res,
    {
      message: "Rent payment generated successfully",
      data: payment,
    },
    201,
  );
};

export const markPaid = async (req: Request, res: Response): Promise<void> => {
  const rentPaymentId = requireUUID(String(req.params.id), "rent payment id");
  const payment = await markRentPaymentPaid(rentPaymentId);
  sendSuccess(res, {
    message: "Rent payment marked as paid",
    data: payment,
  });
};
