import type { NextFunction, Request, Response } from "express";
import config from "../config";
import { AppError } from "../errors";
import { sendError } from "../utils/response";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    sendError(
      res,
      { message: err.message, errors: err.errors },
      err.statusCode,
    );
    return;
  }

  if (err instanceof Error) {
    if (config.isProduction) {
      sendError(res, { message: "Internal server error", errors: null }, 500);
      return;
    }
    sendError(res, { message: err.message, errors: err.stack ?? null }, 500);
    return;
  }

  sendError(res, { message: "Internal server error", errors: null }, 500);
};
