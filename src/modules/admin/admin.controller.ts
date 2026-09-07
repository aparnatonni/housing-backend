import type { Request, Response } from "express";
import { requireUUID, sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import {
  getDashboardStats,
  listAllPayments,
  listAuditLogs,
  updatePropertyStatus,
} from "./admin.service";
import {
  listAuditLogsQuerySchema,
  listPaymentsAdminQuerySchema,
  updatePropertyStatusSchema,
} from "./admin.validation";

export const dashboardStats = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const stats = await getDashboardStats();
  sendSuccess(res, {
    message: "Dashboard stats fetched successfully",
    data: stats,
  });
};

export const auditLogs = async (req: Request, res: Response): Promise<void> => {
  const query = validateBody(listAuditLogsQuerySchema, req.query ?? {});
  const result = await listAuditLogs(query);
  sendSuccess(res, {
    message: "Audit logs fetched successfully",
    data: result,
  });
};

export const propertyStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const propertyId = requireUUID(String(req.params.id), "property id");
  const input = validateBody(updatePropertyStatusSchema, req.body ?? {});
  const property = await updatePropertyStatus(propertyId, input.status);
  sendSuccess(res, {
    message: `Property set to ${input.status.toLowerCase()} successfully`,
    data: property,
  });
};

export const payments = async (req: Request, res: Response): Promise<void> => {
  const query = validateBody(listPaymentsAdminQuerySchema, req.query ?? {});
  const result = await listAllPayments(query);
  sendSuccess(res, {
    message: "Payments fetched successfully",
    data: result,
  });
};
