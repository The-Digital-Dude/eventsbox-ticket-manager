import { v2 as cloudinary } from "cloudinary";
import { env } from "@/src/lib/env";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

let configured = false;

function ensureCloudinaryConfigured() {
  if (configured) return true;

  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return false;
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
  return true;
}

export function isEventImageUploadConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

export class EventImageUploadError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function uploadEventImage(file: File) {
  if (!ensureCloudinaryConfigured()) {
    throw new EventImageUploadError("UPLOAD_NOT_CONFIGURED", "Image upload service is not configured", 503);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new EventImageUploadError("INVALID_FILE_TYPE", "Only JPG, PNG, WEBP or GIF files are allowed");
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new EventImageUploadError("INVALID_FILE_SIZE", "Image must be between 1 byte and 5MB");
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const folder = env.CLOUDINARY_UPLOAD_FOLDER || "eventsbox/events";
  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image",
    transformation: [{ width: 2200, height: 2200, crop: "limit", quality: "auto", fetch_format: "auto" }],
  });

  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    width: uploaded.width,
    height: uploaded.height,
    bytes: uploaded.bytes,
    format: uploaded.format,
  };
}
