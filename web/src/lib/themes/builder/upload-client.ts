"use client";

import { upload } from "@vercel/blob/client";
import { registerThemeAssetAction } from "@/lib/admin/themes/builder-actions";

/**
 * One upload entry point for the editor.
 *
 * Production hands the bytes straight to Vercel Blob (no function in the middle,
 * so no 4.5MB request ceiling); a machine with no blob token posts to the local
 * route instead. Either way the DB row is written by the same server action
 * afterwards, so the two environments cannot drift apart.
 */

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

export interface UploadResult {
  url: string;
  width: number | null;
  height: number | null;
}

/** Read real pixel dimensions here — the server has no image library. */
async function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

export async function uploadThemeAsset(options: {
  file: File;
  themeId: string;
  variantId: string | null;
  slot: string;
  blobEnabled: boolean;
}): Promise<UploadResult> {
  const { file, themeId, variantId, slot, blobEnabled } = options;

  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw new Error("صيغة غير مدعومة — استخدم PNG أو JPG أو WebP");

  const dims = await readDimensions(file);

  let url: string;
  let blobPath: string;

  if (blobEnabled) {
    // Must match the pathname the token endpoint will accept.
    const pathname = `themes/${themeId}/${slot}-${crypto.randomUUID()}.${ext}`;
    const result = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/admin/themes/blob-token",
      contentType: file.type,
    });
    url = result.url;
    blobPath = result.pathname;
  } else {
    const body = new FormData();
    body.set("file", file);
    body.set("themeId", themeId);
    body.set("slot", slot);
    const response = await fetch("/api/admin/themes/upload", { method: "POST", body });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(detail?.error ?? "فشل رفع الصورة");
    }
    const stored = (await response.json()) as { url: string; blobPath: string };
    url = stored.url;
    blobPath = stored.blobPath;
  }

  const state = await registerThemeAssetAction({
    themeId,
    variantId,
    slot,
    url,
    blobPath,
    mimeType: file.type,
    fileSize: file.size,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  });
  if (state?.error) throw new Error(state.error);

  return { url, width: dims?.width ?? null, height: dims?.height ?? null };
}
