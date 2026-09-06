import type { Request, Response } from "express";
import { sendSuccess } from "../../utils";

export const healthController = (_req: Request, res: Response): void => {
  sendSuccess(
    res,
    {
      message: "OK",
      data: { uptime: process.uptime(), timestamp: new Date().toISOString() },
    },
    200,
  );
};
