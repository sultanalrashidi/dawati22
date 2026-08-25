import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { requireUserOrThrow, AuthError } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { SLOT_KEY_PATTERN } from "@/lib/themes/builder/slots";
import { StorageError, isBlobStorageEnabled, storeThemeAsset } from "@/lib/admin/themes/storage";

/**
 * Multipart fallback for environments with no blob token — in practice local
 * development. Production goes through /blob-token so the bytes never touch a
 * function; this route refuses to run there rather than silently writing to a
 * read-only filesystem and failing at the last step.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireUserOrThrow([Role.ADMIN]);

    if (isBlobStorageEnabled()) {
      return NextResponse.json({ error: "Blob storage is configured; use the direct upload path" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const themeId = String(formData.get("themeId") ?? "");
    const slot = String(formData.get("slot") ?? "");

    if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (!SLOT_KEY_PATTERN.test(slot)) return NextResponse.json({ error: "Invalid slot" }, { status: 400 });

    const theme = await prisma.theme.findUnique({ where: { id: themeId }, select: { id: true } });
    if (!theme) return NextResponse.json({ error: "Unknown theme" }, { status: 404 });

    const stored = await storeThemeAsset(theme.id, slot, file);
    return NextResponse.json(stored);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof StorageError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
