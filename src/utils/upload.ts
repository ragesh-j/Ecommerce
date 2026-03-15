import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import r2 from "../config/r2";

// ─── multer — store file in memory before uploading to R2 ─────────────────────
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only jpg, png, webp files are allowed"));
    }
  },
});

// ─── upload to Cloudflare R2 ──────────────────────────────────────────────────
export const uploadToR2 = async (
  file: Express.Multer.File,
  folder: string // e.g. "logos", "products"
): Promise<{ url: string; key: string }> => {
  const ext = path.extname(file.originalname).toLowerCase();
  const key = `${folder}/${randomUUID()}${ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  // use your R2 public URL or custom domain
  const url = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
  return { url, key };
};

// ─── delete from Cloudflare R2 ────────────────────────────────────────────────
export const deleteFromR2 = async (key: string): Promise<void> => {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      Key: key,
    })
  );
};