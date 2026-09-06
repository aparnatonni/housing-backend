import { createHash } from "node:crypto";
import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import jwt, { type SignOptions } from "jsonwebtoken";
import config from "../../config";
import { AppError } from "../../errors";
import prisma from "../../lib/prisma";
import { durationToMs } from "../../utils/duration";
import type { AuthUser } from "./auth.types";
import type { LoginInput, RegisterInput } from "./auth.validation";

const BCRYPT_ROUNDS = 12;
const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const signOptions = (expiresIn: string): SignOptions => ({
  issuer: "housing-backend",
  expiresIn: expiresIn as SignOptions["expiresIn"],
});

export const serializeUser = (user: User): AuthUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  name: user.name,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  isVerified: user.isVerified,
  provider: user.provider,
});

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const signAccessToken = (userId: string, role: User["role"]): string =>
  jwt.sign(
    { sub: userId, role },
    config.jwt.accessSecret,
    signOptions(config.jwt.accessExpiresIn),
  );

export const signRefreshToken = (userId: string): string =>
  jwt.sign(
    { sub: userId },
    config.jwt.refreshSecret,
    signOptions(config.jwt.refreshExpiresIn),
  );

export const refreshCookieMaxAge = (): number =>
  durationToMs(config.jwt.refreshExpiresIn, DEFAULT_REFRESH_MS);

export const generateTokenPair = async (user: User) => {
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshCookieMaxAge()),
    },
  });
  return { accessToken, refreshToken };
};

export const registerUser = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      phone: input.phone || null,
      role: input.role,
    },
  });

  const tokens = await generateTokenPair(user);
  return { user: serializeUser(user), tokens };
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.deletedAt !== null || user.passwordHash === null) {
    throw new AppError("Invalid email or password", 401);
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );
  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  const tokens = await generateTokenPair(user);
  return { user: serializeUser(user), tokens };
};

export const refreshUserSession = async (refreshToken: string) => {
  let sub: string;
  try {
    const payload = jwt.verify(
      refreshToken,
      config.jwt.refreshSecret,
    ) as jwt.JwtPayload;
    if (typeof payload.sub !== "string") throw new Error("missing sub");
    sub = payload.sub;
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (
    !stored ||
    stored.revokedAt !== null ||
    stored.userId !== sub ||
    stored.expiresAt.getTime() < Date.now()
  ) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || user.deletedAt !== null) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await generateTokenPair(user);
  return { user: serializeUser(user), tokens };
};

export const logoutUser = async (refreshToken?: string): Promise<void> => {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const googleLoginUser = async (idToken: string) => {
  if (!config.google.clientId) {
    throw new AppError("Google login is not configured on this server", 500);
  }

  const client = new OAuth2Client(config.google.clientId);
  let payload: TokenPayload | undefined;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError("Invalid Google ID token", 401);
  }

  if (!payload?.email || payload.email_verified !== true) {
    throw new AppError("Your Google account email is not verified", 401);
  }

  const email = payload.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (user && user.deletedAt !== null) {
    throw new AppError("This account has been deactivated", 401);
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: null,
        name: payload.name ?? email.split("@")[0],
        avatarUrl: payload.picture ?? null,
        provider: "GOOGLE",
        googleId: payload.sub ?? null,
        isVerified: true,
      },
    });
  } else if (user.googleId === null) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: payload.sub ?? null },
    });
  }

  const tokens = await generateTokenPair(user);
  return { user: serializeUser(user), tokens };
};
