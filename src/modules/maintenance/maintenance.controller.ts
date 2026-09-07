import type { Request, Response } from "express";
import { AppError } from "../../errors";
import { requireUUID, sendSuccess } from "../../utils";
import { uploadImage } from "../../utils/cloudinary";
import { validateBody } from "../../utils/validate";
import {
  addImagesToMaintenanceRequest,
  createMaintenanceRequest,
  listMyMaintenanceRequests,
  listPropertyMaintenanceRequests,
  updateMaintenanceStatus,
} from "./maintenance.service";
import {
  createMaintenanceRequestSchema,
  updateMaintenanceStatusSchema,
} from "./maintenance.validation";

const requireUser = (req: Request): NonNullable<typeof req.user> => {
  const user = req.user;
  if (!user) {
    throw new AppError("Authentication token is required", 401);
  }
  return user;
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(createMaintenanceRequestSchema, req.body ?? {});
  const user = requireUser(req);
  const request = await createMaintenanceRequest(user.id, input);
  sendSuccess(
    res,
    {
      message: "Maintenance request created successfully",
      data: request,
    },
    201,
  );
};

export const myRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const user = requireUser(req);
  const requests = await listMyMaintenanceRequests(user.id);
  sendSuccess(res, {
    message: "Maintenance requests fetched successfully",
    data: requests,
  });
};

export const propertyRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const propertyId = requireUUID(String(req.params.propertyId), "property id");
  const user = requireUser(req);
  const requests = await listPropertyMaintenanceRequests(user.id, propertyId);
  sendSuccess(res, {
    message: "Maintenance requests fetched successfully",
    data: requests,
  });
};

export const updateStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const requestId = requireUUID(
    String(req.params.id),
    "maintenance request id",
  );
  const input = validateBody(updateMaintenanceStatusSchema, req.body ?? {});
  const user = requireUser(req);
  const request = await updateMaintenanceStatus(user.id, requestId, input);
  sendSuccess(res, {
    message: "Maintenance request status updated successfully",
    data: request,
  });
};

export const uploadIssueImages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const requestId = requireUUID(
    String(req.params.id),
    "maintenance request id",
  );
  const user = requireUser(req);
  const files = (req.files ?? []) as Express.Multer.File[];

  if (files.length === 0) {
    throw new AppError(
      "At least one image file is required (field name: images)",
      400,
    );
  }

  const urls = await Promise.all(
    files.map((file) => uploadImage(file.buffer, "maintenance-images")),
  );
  const request = await addImagesToMaintenanceRequest(
    user.id,
    user.role,
    requestId,
    urls,
  );
  sendSuccess(res, {
    message: "Images uploaded successfully",
    data: request,
  });
};
