import { z } from "zod";

export const initiatePaymentSchema = z.object({
  type: z.enum(["RENT", "BILL"]),
  referenceId: z.string().uuid("A valid reference id is required"),
});

export const listMyPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type ListMyPaymentsQuery = z.infer<typeof listMyPaymentsQuerySchema>;
