import { z } from "zod";

export const viewingRequestSchema = z.object({
  roomId: z.string().uuid("A valid room id is required"),
  requestedDate: z
    .string()
    .datetime("requestedDate must be a valid ISO datetime"),
  notes: z.string().trim().max(500).optional(),
});

export const updateViewingStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "COMPLETED", "CANCELLED"]),
});

export const listViewingRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"])
    .optional(),
});

export type CreateViewingRequestInput = z.infer<typeof viewingRequestSchema>;
export type UpdateViewingStatusInput = z.infer<
  typeof updateViewingStatusSchema
>;
export type ListViewingRequestsQuery = z.infer<
  typeof listViewingRequestsQuerySchema
>;
