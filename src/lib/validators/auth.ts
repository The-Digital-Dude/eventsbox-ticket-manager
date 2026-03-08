import { z } from "zod";

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const loginSchema = registerSchema;

export const verifyEmailSchema = z.object({
  token: z.string().min(6),
});

export const verifyOtpSchema = z.object({
  email: z.email(),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export const resendOtpSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  email: z.email(),
});

export const confirmResetSchema = z.object({
  token: z.string().min(6),
  password: z.string().min(8),
});
