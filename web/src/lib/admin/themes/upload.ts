import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ThemeAdminError } from "@/lib/admin/themes/service";

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Local-disk asset storage (public/uploads/themes/{themeId}/...), suitable for
 * a single-instance self-hosted deployment. Swap for S3/R2/Blob storage
 * behind this same function signature for multi-instance production.
 */
export async function saveThemeAssetFile(themeId: string, file: File) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new ThemeAdminError("Only PNG, JPEG, or WEBP images are allowed");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ThemeAdminError("File exceeds the 5MB limit");
  }

  const dir = path.join(process.cwd(), "public", "uploads", "themes", themeId);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${EXT_BY_MIME[file.type]}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return {
    url: `/uploads/themes/${themeId}/${filename}`,
    mimeType: file.type,
    fileSize: file.size,
  };
}
