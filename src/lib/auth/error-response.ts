import { fail } from "@/src/lib/http/response";

type AuthErrorMessages = {
  unauthenticatedMessage?: string;
  forbiddenMessage?: string;
};

export function authErrorResponse(error: unknown, messages: AuthErrorMessages = {}) {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message === "UNAUTHENTICATED") {
    return fail(401, {
      code: "UNAUTHENTICATED",
      message: messages.unauthenticatedMessage ?? "Login required",
    });
  }

  if (error.message === "ACCOUNT_SUSPENDED") {
    return fail(403, {
      code: "ACCOUNT_SUSPENDED",
      message: "Your account has been suspended.",
    });
  }

  if (error.message === "FORBIDDEN") {
    return fail(403, {
      code: "FORBIDDEN",
      message: messages.forbiddenMessage ?? "Access denied",
    });
  }

  return null;
}
