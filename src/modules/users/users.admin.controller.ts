import type { Request, Response } from "express";
import { sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import { listUsers, updateUserStatus } from "./users.service";
import {
  listUsersQuerySchema,
  updateUserStatusSchema,
} from "./users.validation";

export const listAllUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = validateBody(listUsersQuerySchema, req.query ?? {});
  const result = await listUsers(query);
  sendSuccess(res, {
    message: "Users fetched successfully",
    data: result,
  });
};

export const status = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(updateUserStatusSchema, req.body ?? {});
  const user = await updateUserStatus(String(req.params.id), input.isSuspended);
  sendSuccess(res, {
    message: input.isSuspended
      ? "User suspended successfully"
      : "User activated successfully",
    data: user,
  });
};
