import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z.string().trim().min(1).optional(),
  userId: z.string().uuid("A valid user id is required").optional(),
  from: z.string().datetime("from must be a valid ISO datetime").optional(),
  to: z.string().datetime("to must be a valid ISO datetime").optional(),
});

export const updatePropertyStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const listPaymentsAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
  gateway: z
    .enum(["STRIPE", "RAZORPAY", "PAYPAL", "CASH", "SSLCOMMERZ", "OTHER"])
    .optional(),
  purpose: z.enum(["RENT", "BILL", "DEPOSIT", "OTHER"]).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
export type UpdatePropertyStatusInput = z.infer<
  typeof updatePropertyStatusSchema
>;
export type ListPaymentsAdminQuery = z.infer<
  typeof listPaymentsAdminQuerySchema
>;
