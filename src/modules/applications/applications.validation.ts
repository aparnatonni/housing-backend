import { z } from "zod";

export const applicationSchema = z.object({
  roomId: z.string().uuid("A valid room id is required"),
  moveInDate: z
    .string()
    .datetime("moveInDate must be a valid ISO datetime")
    .optional()
    .nullable(),
  note: z.string().trim().max(500).optional(),
});

export const listApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]).optional(),
});

export type CreateApplicationInput = z.infer<typeof applicationSchema>;
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
