import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../../config";
import { AppError } from "../../errors";
import prisma from "../../lib/prisma";
import type { AuthUser } from "./auth.types";

export const extractBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

export const protect = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = extractBearerToken(req);
  if (!token) {
    next(new AppError("Authentication token is required", 401));
    return;
  }

  try {
    const payload = jwt.verify(
      token,
      config.jwt.accessSecret,
    ) as jwt.JwtPayload;
    if (typeof payload.sub !== "string") {
      throw new Error("invalid token payload");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        avatarUrl: true,
        isVerified: true,
        provider: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new Error("user not found");
    }

    const { deletedAt: _deletedAt, ...safeUser } = user;
    req.user = safeUser as AuthUser;
    next();
  } catch {
    next(new AppError("Invalid or expired access token", 401));
  }
};

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("Authentication token is required", 401));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(
        new AppError("You do not have permission to perform this action", 403),
      );
      return;
    }
    next();
  };
