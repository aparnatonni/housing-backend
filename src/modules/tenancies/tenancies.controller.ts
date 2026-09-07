import type { Request, Response } from "express";
import { AppError } from "../../errors";
import { requireUUID, sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import { getMyTenancy, listTenanciesByProperty } from "./tenancies.service";
import { listTenanciesQuerySchema } from "./tenancies.validation";

const requireUserId = (req: Request): string => {
  const user = req.user;
  if (!user) {
    throw new AppError("Authentication token is required", 401);
  }
  return user.id;
};

export const myTenancy = async (req: Request, res: Response): Promise<void> => {
  const tenancy = await getMyTenancy(requireUserId(req));
  sendSuccess(res, {
    message: "Active tenancy fetched successfully",
    data: tenancy,
  });
};

export const byProperty = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const propertyId = requireUUID(String(req.params.propertyId), "property id");
  const query = validateBody(listTenanciesQuerySchema, req.query ?? {});
  const result = await listTenanciesByProperty(
    requireUserId(req),
    propertyId,
    query,
  );
  sendSuccess(res, {
    message: "Tenancies fetched successfully",
    data: result,
  });
};
