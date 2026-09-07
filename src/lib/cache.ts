import type { RedisClientType } from "redis";
import { createClient } from "redis";
import config from "../config";

const LIST_CACHE_PREFIX = "properties:";
const CACHE_TTL_SECONDS = 60;

let client: RedisClientType | null = null;

const ensureClient = (): RedisClientType | null => {
  if (!config.redis.url) {
    return null;
  }
  if (!client) {
    client = createClient({ url: config.redis.url });
    client.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cache] redis error: ${message}`);
    });
  }
  return client;
};

export const cacheGet = async <T>(
  key: string,
): Promise<{ hit: boolean; value: T | null }> => {
  const redis = ensureClient();
  if (!redis) {
    return { hit: false, value: null };
  }
  if (!redis.isReady) {
    try {
      await redis.connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cache] connect failed: ${message}`);
      return { hit: false, value: null };
    }
  }
  try {
    const raw = await redis.get(key);
    if (raw === null) {
      return { hit: false, value: null };
    }
    return { hit: true, value: JSON.parse(raw) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cache] get failed: ${message}`);
    return { hit: false, value: null };
  }
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds = CACHE_TTL_SECONDS,
): Promise<void> => {
  const redis = ensureClient();
  if (!redis) {
    return;
  }
  if (!redis.isReady) {
    try {
      await redis.connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cache] connect failed: ${message}`);
      return;
    }
  }
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cache] set failed: ${message}`);
  }
};

export const cacheInvalidate = async (pattern: string): Promise<void> => {
  const redis = ensureClient();
  if (!redis) {
    return;
  }
  if (!redis.isReady) {
    try {
      await redis.connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cache] connect failed: ${message}`);
      return;
    }
  }
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cache] invalidate failed: ${message}`);
  }
};

export const propertiesListKey = (query: unknown): string =>
  `${LIST_CACHE_PREFIX}${JSON.stringify(query)}`;

export const invalidatePropertyLists = (): Promise<void> =>
  cacheInvalidate(`${LIST_CACHE_PREFIX}*`);
