import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

/**
 * Theme asset storage.
 *
 * Production writes to Vercel Blob. Local development usually has no blob
 * token, so the same two functions fall back to `public/uploads/` on disk —
 * that keeps the builder fully testable offline without the calling code
 * having to know which backend it got. `blobPath` on the stored row is what
 * tells a later delete which backend owns the object.
 */

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;
export const MAX_ASSET_BYTES = 12 * 1024 * 1024; // 12MB

export class StorageError extends Error {}

export function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export interface StoredAsset {
  url: string;
  blobPath: string;
  mimeType: string;
  fileSize: number;
}

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    default:
      throw new StorageError(`Unsupported image type: ${mimeType}`);
  }
}

export function assertUploadable(file: File) {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new StorageError("Only PNG, JPEG, WebP, or AVIF images are allowed");
  }
  if (file.size === 0) throw new StorageError("The file is empty");
  if (file.size > MAX_ASSET_BYTES) throw new StorageError("File exceeds the 12MB limit");
}

/**
 * Build the object path. Slot and ids are already validated by the caller, but
 * the path is still assembled from sanitised parts only — never from a
 * client-supplied filename, which could carry `../` or a stray extension.
 */
export function assetPathname(themeId: string, slot: string, mimeType: string): string {
  const safeTheme = themeId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeSlot = slot.replace(/[^a-zA-Z0-9-]/g, "");
  return `themes/${safeTheme}/${safeSlot}-${randomUUID()}.${extensionFor(mimeType)}`;
}

export async function storeThemeAsset(themeId: string, slot: string, file: File): Promise<StoredAsset> {
  assertUploadable(file);
  const pathname = assetPathname(themeId, slot, file.type);

  if (isBlobStorageEnabled()) {
    const result = await put(pathname, file, {
      access: "public",
      contentType: file.type,
      // The pathname already carries a UUID, so it is unique without Vercel
      // appending a second random segment we'd have to store separately.
      addRandomSuffix: false,
    });
    return { url: result.url, blobPath: result.pathname, mimeType: file.type, fileSize: file.size };
  }

  const relative = path.join("uploads", pathname);
  const absolute = path.join(process.cwd(), "public", relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()));
  return { url: `/${relative}`, blobPath: `local:${relative}`, mimeType: file.type, fileSize: file.size };
}

/**
 * The only shapes `storeThemeAsset` and the blob client ever produce. Anything
 * else reaching a delete came from somewhere it shouldn't have.
 */
const BLOB_PATH_PATTERN =
  /^(local:uploads\/)?themes\/[a-z0-9]+\/[a-zA-Z][a-zA-Z0-9-]{0,39}-[0-9a-f-]{36}\.(png|jpg|webp|avif)$/;

export function isSafeBlobPath(blobPath: string): boolean {
  return BLOB_PATH_PATTERN.test(blobPath);
}

/**
 * Best-effort object cleanup. A failure here must not block deleting the row —
 * an orphaned object costs storage, an undeletable asset row blocks the admin.
 *
 * The path is re-checked rather than trusted: it round-trips through the
 * browser on its way to the database, and `local:` paths are handed to `rm`,
 * where a `../` would escape the uploads directory entirely.
 */
export async function removeStoredAsset(blobPath: string | null): Promise<void> {
  if (!blobPath) return;
  if (!isSafeBlobPath(blobPath)) {
    console.error("[theme-storage] refusing to delete unexpected path", blobPath);
    return;
  }
  try {
    if (blobPath.startsWith("local:")) {
      await rm(path.join(process.cwd(), "public", blobPath.slice("local:".length)), { force: true });
      return;
    }
    if (isBlobStorageEnabled()) await del(blobPath);
  } catch (error) {
    console.error("[theme-storage] failed to delete asset", blobPath, error);
  }
}
