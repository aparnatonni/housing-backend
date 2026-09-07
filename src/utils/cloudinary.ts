import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import config from "../config";
import { AppError } from "../errors";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

export const isUploadConfigured = (): boolean =>
  Boolean(
    config.cloudinary.cloudName &&
      config.cloudinary.apiKey &&
      config.cloudinary.apiSecret,
  );

export const uploadImage = async (
  buffer: Buffer,
  folder = "property-images",
): Promise<string> => {
  if (!isUploadConfigured()) {
    throw new AppError(
      "Image upload is not configured. Set CLOUDINARY_* environment variables.",
      503,
    );
  }

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) {
          reject(new AppError("Image upload failed", 502));
          return;
        }
        resolve((result as UploadApiResponse).secure_url);
      },
    );
    stream.end(buffer);
  });
};
