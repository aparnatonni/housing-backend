import type { Request, Response } from "express";
import { AppError } from "../../errors";
import { requireUUID, sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import {
  approveApplication,
  createApplication,
  listMyApplications,
  rejectApplication,
} from "./applications.service";
import {
  applicationSchema,
  listApplicationsQuerySchema,
} from "./applications.validation";

const requireUserId = (req: Request): string => {
  const user = req.user;
  if (!user) {
    throw new AppError("Authentication token is required", 401);
  }
  return user.id;
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(applicationSchema, req.body ?? {});
  const application = await createApplication(requireUserId(req), input);
  sendSuccess(
    res,
    {
      message: "Application submitted successfully",
      data: application,
    },
    201,
  );
};

export const myApplications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = validateBody(listApplicationsQuerySchema, req.query ?? {});
  const result = await listMyApplications(requireUserId(req), query);
  sendSuccess(res, {
    message: "Applications fetched successfully",
    data: result,
  });
};

export const approve = async (req: Request, res: Response): Promise<void> => {
  const id = requireUUID(String(req.params.id), "application id");
  const application = await approveApplication(requireUserId(req), id);
  sendSuccess(res, {
    message: "Application approved successfully",
    data: application,
  });
};

export const reject = async (req: Request, res: Response): Promise<void> => {
  const id = requireUUID(String(req.params.id), "application id");
  const application = await rejectApplication(requireUserId(req), id);
  sendSuccess(res, {
    message: "Application rejected successfully",
    data: application,
  });
};
