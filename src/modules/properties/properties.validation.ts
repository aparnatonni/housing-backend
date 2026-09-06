import { z } from "zod";

const imageUrlSchema = z
  .string()
  .trim()
  .url("Each image must be a valid URL")
  .max(500);
const imagesSchema = z.array(imageUrlSchema).max(12).optional();

export const createPropertySchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(150),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().min(5, "Address is required").max(200),
  city: z.string().trim().min(2, "City is required").max(100),
  area: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  zipCode: z.string().trim().max(20).optional(),
  propertyType: z.enum(["APARTMENT", "HOUSE", "STUDIO", "CONDO", "TOWNHOUSE"]),
  amenities: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
  images: imagesSchema,
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const updatePropertySchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(150)
    .optional(),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().min(5, "Address is required").max(200).optional(),
  city: z.string().trim().min(2, "City is required").max(100).optional(),
  area: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  zipCode: z.string().trim().max(20).optional(),
  propertyType: z
    .enum(["APARTMENT", "HOUSE", "STUDIO", "CONDO", "TOWNHOUSE"])
    .optional(),
  amenities: z.array(z.string().trim().min(1).max(50)).max(50).optional(),
  images: imagesSchema,
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const coerceNonNeg = z.coerce.number().nonnegative();

export const listPropertiesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    city: z.string().trim().max(100).optional(),
    minRent: coerceNonNeg.optional(),
    maxRent: coerceNonNeg.optional(),
    propertyType: z
      .enum(["APARTMENT", "HOUSE", "STUDIO", "CONDO", "TOWNHOUSE"])
      .optional(),
    sortBy: z
      .enum(["newest", "oldest", "price_asc", "price_desc"])
      .default("newest"),
    search: z.string().trim().max(200).optional(),
  })
  .refine(
    (data) =>
      data.minRent === undefined ||
      data.maxRent === undefined ||
      data.minRent <= data.maxRent,
    {
      path: ["maxRent"],
      message: "maxRent must be greater than or equal to minRent",
    },
  );

export const createRoomSchema = z.object({
  roomType: z
    .enum(["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "MASTER", "STUDIO"])
    .default("SINGLE"),
  rentAmount: z.number().positive("Rent must be a positive number"),
  isAvailable: z.boolean().default(true),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
  images: imagesSchema,
});

export const updateRoomSchema = z.object({
  roomType: z
    .enum(["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "MASTER", "STUDIO"])
    .optional(),
  rentAmount: z.number().positive("Rent must be a positive number").optional(),
  isAvailable: z.boolean().optional(),
  capacity: z.coerce
    .number()
    .int()
    .min(1, "Capacity must be at least 1")
    .optional(),
  images: imagesSchema,
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type ListPropertiesQuery = z.infer<typeof listPropertiesQuerySchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
