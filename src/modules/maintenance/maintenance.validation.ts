import { z } from "zod";

export const createMaintenanceRequestSchema = z.object({
  roomId: z.string().uuid("roomId must be a valid UUID"),
  category: z.string().trim().min(1, "category is required").max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export const updateMaintenanceStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

export type CreateMaintenanceRequestInput = z.infer<
  typeof createMaintenanceRequestSchema
>;

export type UpdateMaintenanceStatusInput = z.infer<
  typeof updateMaintenanceStatusSchema
>;
