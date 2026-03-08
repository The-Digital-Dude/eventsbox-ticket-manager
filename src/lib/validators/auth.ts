import { z } from "zod";

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const loginSchema = registerSchema;

export const verifyEmailSchema = z.object({
  token: z.string().min(6),
});

export const resetPasswordSchema = z.object({
  email: z.email(),
});

export const confirmResetSchema = z.object({
  token: z.string().min(6),
  password: z.string().min(8),
});
