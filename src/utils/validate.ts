import type { ZodType } from "zod";
import { AppError } from "../errors";

export const validateBody = <T>(schema: ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "body";
      const messages = errors[key];
      if (messages) {
        messages.push(issue.message);
      } else {
        errors[key] = [issue.message];
      }
    }
    throw new AppError("Validation failed", 400, errors);
  }
  return result.data;
};
