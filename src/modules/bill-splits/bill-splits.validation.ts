import { z } from "zod";

export const BILL_TYPES = [
  "ELECTRICITY",
  "WATER",
  "GAS",
  "INTERNET",
  "OTHER",
] as const;

export const createBillSplitSchema = z
  .object({
    tenancyId: z.string().uuid("A valid tenancy id is required"),
    billType: z.enum(BILL_TYPES),
    totalAmount: z.number().positive("totalAmount must be positive"),
    dueDate: z
      .string()
      .datetime("dueDate must be a valid ISO datetime")
      .optional()
      .nullable(),
    ratio: z
      .array(
        z.number().positive("Ratio values must be positive").max(100_000_000),
      )
      .min(1)
      .optional(),
    shares: z
      .array(
        z
          .object({
            tenantId: z.string().uuid("A valid tenant id is required"),
            amount: z
              .number()
              .nonnegative("Share amounts must be non-negative"),
          })
          .strict(),
      )
      .min(1)
      .optional(),
  })
  .refine((data) => !(data.ratio && data.shares), {
    message: "Provide either ratio or shares, not both",
    path: ["ratio"],
  });

export type CreateBillSplitInput = z.infer<typeof createBillSplitSchema>;
