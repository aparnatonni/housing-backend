import { z } from "zod";

export const generateRentPaymentSchema = z.object({
  dueDate: z
    .string()
    .datetime("dueDate must be a valid ISO datetime")
    .optional()
    .nullable(),
});

export type GenerateRentPaymentInput = z.infer<
  typeof generateRentPaymentSchema
>;
