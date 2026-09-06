import type { Response } from "express";

export type SuccessBody<T = unknown> = {
  success: true;
  message: string;
  data: T;
};

export type ErrorBody = {
  success: false;
  message: string;
  errors: unknown;
};

export const sendSuccess = <T>(
  res: Response,
  body: Omit<SuccessBody<T>, "success">,
  statusCode = 200,
): void => {
  const payload: SuccessBody<T> = { success: true, ...body };
  res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  body: Omit<ErrorBody, "success">,
  statusCode = 500,
): void => {
  const payload: ErrorBody = { success: false, ...body };
  res.status(statusCode).json(payload);
};
