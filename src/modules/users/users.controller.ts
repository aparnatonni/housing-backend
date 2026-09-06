import type { Request, Response } from "express";
import { AppError } from "../../errors";
import prisma from "../../lib/prisma";
import { sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import {
  changePassword,
  getProfile,
  getPublicProfile,
  updateProfile,
} from "./users.service";
import { changePasswordSchema, updateProfileSchema } from "./users.validation";

const requireUserId = (req: Request): string => {
  const user = req.user;
  if (!user) {
    throw new AppError("Authentication token is required", 401);
  }
  return user.id;
};

export const me = async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: requireUserId(req) },
  });
  if (!user || user.deletedAt !== null) {
    throw new AppError("User not found", 404);
  }
  sendSuccess(res, {
    message: "Profile fetched successfully",
    data: getProfile(user),
  });
};

export const updateMe = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(updateProfileSchema, req.body ?? {});
  const { user } = await updateProfile(requireUserId(req), input);
  sendSuccess(res, {
    message: "Profile updated successfully",
    data: user,
  });
};

export const viewUser = async (req: Request, res: Response): Promise<void> => {
  const profile = await getPublicProfile(String(req.params.id));
  sendSuccess(res, {
    message: "User profile fetched successfully",
    data: profile,
  });
};

export const changeOwnPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const input = validateBody(changePasswordSchema, req.body ?? {});
  const user = await prisma.user.findUnique({
    where: { id: requireUserId(req) },
  });
  if (!user || user.deletedAt !== null) {
    throw new AppError("User not found", 404);
  }
  await changePassword(user, input);
  sendSuccess(res, { message: "Password changed successfully", data: null });
};
