import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { Role } from "@/generated/prisma/client";
import { requireUserOrThrow, AuthError } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { ALLOWED_IMAGE_TYPES, MAX_ASSET_BYTES } from "@/lib/admin/themes/storage";

/**
 * Issues short-lived client tokens so the browser uploads straight to Vercel
 * Blob. Going through a Server Action instead would cap uploads at 1MB (and at
 * 4.5MB through any route handler on Vercel), which a high-resolution PNG
 * background blows past — this path has no such ceiling.
 *
 * The token is scoped to exactly one pathname, and the pathname the client asks
 * for is checked here before signing: an admin session is not permission to
 * write anywhere in the store.
 */

const PATHNAME_PATTERN =
  /^themes\/([a-z0-9]+)\/([a-zA-Z][a-zA-Z0-9-]{0,39})-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|avif)$/;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Runs on every token request — this is the authorization boundary,
        // not the page that rendered the upload button.
        await requireUserOrThrow([Role.ADMIN]);

        const match = PATHNAME_PATTERN.exec(pathname);
        if (!match) throw new Error("Rejected upload path");

        const theme = await prisma.theme.findUnique({ where: { id: match[1] }, select: { id: true } });
        if (!theme) throw new Error("Unknown theme");

        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          maximumSizeInBytes: MAX_ASSET_BYTES,
          addRandomSuffix: false,
        };
      },
      // Deliberately no onUploadCompleted: Vercel cannot reach a localhost
      // callback, so the row is written by registerThemeAssetAction once the
      // browser's upload() resolves. That works identically in both places.
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
