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

const config = {
  env: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL ?? "",
  cors: {
    origin: process.env.CORS_ORIGIN ?? "*",
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
  isProduction: parseBoolean(process.env.IS_PRODUCTION),
};

export default config;
