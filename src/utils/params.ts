import { z } from "zod";
import { AppError } from "../errors";

const uuidSchema = z.string().uuid();

export const requireUUID = (value: string, label = "id"): string => {
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return result.data;
};
