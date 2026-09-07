import type { Request, Response } from "express";
import { AppError } from "../../errors";
import { requireUUID, sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import {
  createViewingRequest,
  listMyRequests,
  listReceivedRequests,
  updateViewingStatus,
} from "./viewing-requests.service";
import {
  listViewingRequestsQuerySchema,
  updateViewingStatusSchema,
  viewingRequestSchema,
} from "./viewing-requests.validation";

const requireUserId = (req: Request): string => {
  const user = req.user;
  if (!user) {
    throw new AppError("Authentication token is required", 401);
  }
  return user.id;
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(viewingRequestSchema, req.body ?? {});
  const request = await createViewingRequest(requireUserId(req), input);
  sendSuccess(
    res,
    {
      message: "Viewing request submitted successfully",
      data: request,
    },
    201,
  );
};

export const myRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = validateBody(listViewingRequestsQuerySchema, req.query ?? {});
  const result = await listMyRequests(requireUserId(req), query);
  sendSuccess(res, {
    message: "Viewing requests fetched successfully",
    data: result,
  });
};

export const received = async (req: Request, res: Response): Promise<void> => {
  const query = validateBody(listViewingRequestsQuerySchema, req.query ?? {});
  const result = await listReceivedRequests(requireUserId(req), query);
  sendSuccess(res, {
    message: "Received viewing requests fetched successfully",
    data: result,
  });
};

export const updateStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = requireUUID(String(req.params.id), "viewing request id");
  const input = validateBody(updateViewingStatusSchema, req.body ?? {});
  const request = await updateViewingStatus(
    requireUserId(req),
    id,
    input.status,
  );
  sendSuccess(res, {
    message: `Viewing request ${input.status.toLowerCase()} successfully`,
    data: request,
  });
};
