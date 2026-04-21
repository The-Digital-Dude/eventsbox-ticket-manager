
import { z } from "zod";

export function validate<T>(schema: z.ZodSchema<T>, data: T) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { isValid: true, errors: {} };
  }

  const errors = result.error.flatten().fieldErrors;
  return { isValid: false, errors };
}
