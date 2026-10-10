import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../.env") });

const parsePort = (value: string | undefined): number => {
  const port = Number(value ?? 5000);
  return Number.isNaN(port) ? 5000 : port;
};

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  return ["true", "1", "yes"].includes(value.toLowerCase());
};

const parseCorsOrigin = (value: string | undefined): string | string[] => {
  if (!value) {
    return ["http://localhost:3000", "https://housing-frontend-jet.vercel.app"];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return ["http://localhost:3000", "https://housing-frontend-jet.vercel.app"];
  }
  const origins = trimmed
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (origins.length === 0) {
    return ["http://localhost:3000", "https://housing-frontend-jet.vercel.app"];
  }
  return origins;
};

const config = {
  env: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL ?? "",
  cors: {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 100),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.SMTP_FROM ?? "",
  },
  redis: {
    url: process.env.REDIS_URL ?? "",
  },
  sslcommerz: {
    storeId: process.env.SSLCOMMERZ_STORE_ID ?? "",
    storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD ?? "",
    isLive: parseBoolean(process.env.SSLCOMMERZ_IS_LIVE),
    successUrl:
      process.env.SSLCOMMERZ_SUCCESS_URL ??
      "http://localhost:5000/api/v1/payments/success",
    failUrl:
      process.env.SSLCOMMERZ_FAIL_URL ??
      "http://localhost:5000/api/v1/payments/fail",
    cancelUrl:
      process.env.SSLCOMMERZ_CANCEL_URL ??
      "http://localhost:5000/api/v1/payments/cancel",
    ipnUrl:
      process.env.SSLCOMMERZ_IPN_URL ??
      "http://localhost:5000/api/v1/payments/webhook",
  },
  isProduction: parseBoolean(process.env.IS_PRODUCTION),
};

export default config;
