import type { Request, Response } from "express";
import { AppError } from "../../errors";
import { cacheGet, cacheSet, propertiesListKey } from "../../lib/cache";
import { sendSuccess } from "../../utils";
import { uploadImage } from "../../utils/cloudinary";
import { validateBody } from "../../utils/validate";
import {
  addImagesToProperty,
  createProperty,
  createRoom,
  getPropertyById,
  listMyProperties,
  listProperties,
  softDeleteProperty,
  updateProperty,
} from "./properties.service";
import {
  createPropertySchema,
  createRoomSchema,
  listPropertiesQuerySchema,
  updatePropertySchema,
} from "./properties.validation";

const requireUserId = (req: Request): string => {
  const user = req.user;
  if (!user) {
    throw new AppError("Authentication token is required", 401);
  }
  return user.id;
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(createPropertySchema, req.body ?? {});
  const property = await createProperty(requireUserId(req), input);
  sendSuccess(
    res,
    {
      message: "Property created successfully",
      data: property,
    },
    201,
  );
};

export const list = async (req: Request, res: Response): Promise<void> => {
  const query = validateBody(listPropertiesQuerySchema, req.query ?? {});
  const cacheKey = propertiesListKey(query);
  const cached =
    await cacheGet<Awaited<ReturnType<typeof listProperties>>>(cacheKey);
  if (cached.hit && cached.value) {
    res.setHeader("X-Cache", "HIT");
    sendSuccess(res, {
      message: "Properties fetched successfully",
      data: cached.value,
    });
    return;
  }
  const result = await listProperties(query);
  await cacheSet(cacheKey, result);
  res.setHeader("X-Cache", "MISS");
  sendSuccess(res, {
    message: "Properties fetched successfully",
    data: result,
  });
};

export const details = async (req: Request, res: Response): Promise<void> => {
  const property = await getPropertyById(String(req.params.id));
  sendSuccess(res, {
    message: "Property fetched successfully",
    data: property,
  });
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(updatePropertySchema, req.body ?? {});
  const property = await updateProperty(
    requireUserId(req),
    String(req.params.id),
    input,
  );
  sendSuccess(res, {
    message: "Property updated successfully",
    data: property,
  });
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const id = await softDeleteProperty(
    requireUserId(req),
    String(req.params.id),
  );
  sendSuccess(res, {
    message: "Property deleted successfully",
    data: { id },
  });
};

export const myProperties = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = validateBody(listPropertiesQuerySchema, req.query ?? {});
  const result = await listMyProperties(requireUserId(req), {
    page: query.page,
    limit: query.limit,
    search: query.search,
  });
  sendSuccess(res, {
    message: "Properties fetched successfully",
    data: result,
  });
};

export const addRoom = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(createRoomSchema, req.body ?? {});
  const room = await createRoom(
    requireUserId(req),
    String(req.params.id),
    input,
  );
  sendSuccess(
    res,
    {
      message: "Room created successfully",
      data: room,
    },
    201,
  );
};

export const uploadPropertyImages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const ownerId = requireUserId(req);
  const propertyId = String(req.params.id);
  const files = (req.files ?? []) as Express.Multer.File[];

  if (files.length === 0) {
    throw new AppError(
      "At least one image file is required (field name: images)",
      400,
    );
  }

  const urls = await Promise.all(files.map((file) => uploadImage(file.buffer)));
  const property = await addImagesToProperty(ownerId, propertyId, urls);
  sendSuccess(res, {
    message: "Images uploaded successfully",
    data: property,
  });
};
