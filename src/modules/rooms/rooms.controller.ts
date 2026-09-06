import type { Request, Response } from "express";
import { AppError } from "../../errors";
import { sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import { softDeleteRoom, updateRoom } from "../properties/properties.service";
import { updateRoomSchema } from "../properties/properties.validation";

const requireUserId = (req: Request): string => {
  const user = req.user;
  if (!user) {
    throw new AppError("Authentication token is required", 401);
  }
  return user.id;
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(updateRoomSchema, req.body ?? {});
  const room = await updateRoom(
    requireUserId(req),
    String(req.params.id),
    input,
  );
  sendSuccess(res, {
    message: "Room updated successfully",
    data: room,
  });
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const id = await softDeleteRoom(requireUserId(req), String(req.params.id));
  sendSuccess(res, {
    message: "Room deleted successfully",
    data: { id },
  });
};
