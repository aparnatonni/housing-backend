import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../../errors";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new AppError("Only image files are allowed", 400));
      return;
    }
    cb(null, true);
  },
});

export const uploadImages = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  upload.array("images", 10)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(new AppError("Each image must be 5MB or smaller", 400));
        return;
      }
      next(new AppError(`Image upload failed: ${err.message}`, 400));
      return;
    }
    next(err);
  });
};
