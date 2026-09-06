import { z } from "zod";

const optionalString = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const roommatePreferenceSchema = z
  .object({
    minBudget: z.number().nonnegative().optional(),
    maxBudget: z.number().nonnegative().optional(),
    preferredCity: z.string().trim().max(100).optional(),
    preferredArea: z.string().trim().max(100).optional(),
    genderPreference: z.enum(["MALE", "FEMALE", "ANY"]).optional(),
    lifestyleTags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
    isSmoker: z.boolean().optional(),
    hasPets: z.boolean().optional(),
    moveInDate: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) =>
      data.minBudget === undefined ||
      data.maxBudget === undefined ||
      data.minBudget <= data.maxBudget,
    {
      path: ["maxBudget"],
      message: "maxBudget must be greater than or equal to minBudget",
    },
  );

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100)
    .optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[+()\d][\d\s-()]*$/, "Please provide a valid phone number")
    .optional()
    .or(z.literal("")),
  avatarUrl: z
    .union([
      z.string().trim().url("Avatar URL must be valid").max(500),
      z.literal(""),
    ])
    .optional(),
  bio: optionalString(500),
  roommatePreference: roommatePreferenceSchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters long")
    .regex(/[A-Za-z]/, "New password must contain at least one letter")
    .regex(/\d/, "New password must contain at least one number"),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(["TENANT", "OWNER", "ADMIN"]).optional(),
  search: z.string().trim().max(100).optional(),
});

export const updateUserStatusSchema = z.object({
  isSuspended: z.boolean(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RoommatePreferenceInput = z.infer<typeof roommatePreferenceSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
