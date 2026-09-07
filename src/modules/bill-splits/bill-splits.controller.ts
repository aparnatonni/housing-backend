import type { Request, Response } from "express";
import { AppError } from "../../errors";
import { requireUUID, sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import {
  createBillSplit,
  listBillSplitsByTenancy,
  settleShare,
} from "./bill-splits.service";
import { createBillSplitSchema } from "./bill-splits.validation";

const requireUser = (req: Request): NonNullable<typeof req.user> => {
  const user = req.user;
  if (!user) {
    throw new AppError("Authentication token is required", 401);
  }
  return user;
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(createBillSplitSchema, req.body ?? {});
  const user = requireUser(req);
  const bill = await createBillSplit(user.id, user.role, input);
  sendSuccess(
    res,
    {
      message: "Bill split created successfully",
      data: bill,
    },
    201,
  );
};

export const byTenancy = async (req: Request, res: Response): Promise<void> => {
  const tenancyId = requireUUID(String(req.params.tenancyId), "tenancy id");
  const user = requireUser(req);
  const bills = await listBillSplitsByTenancy(user.id, user.role, tenancyId);
  sendSuccess(res, {
    message: "Bill splits fetched successfully",
    data: bills,
  });
};

export const settle = async (req: Request, res: Response): Promise<void> => {
  const shareId = requireUUID(String(req.params.id), "share id");
  const user = requireUser(req);
  const result = await settleShare(user.id, shareId);
  sendSuccess(res, {
    message: "Share settled successfully",
    data: result,
  });
};
