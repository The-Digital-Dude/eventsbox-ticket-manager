import * as Sentry from "@sentry/nextjs";

export async function register() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.2,
    enabled: process.env.NODE_ENV === "production",
  });
}

export const onRequestError = Sentry.captureRequestError;
