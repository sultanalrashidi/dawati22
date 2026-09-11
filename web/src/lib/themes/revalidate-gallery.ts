import "server-only";
import { revalidatePath } from "next/cache";

/**
 * The public design gallery is a static file (`[locale]/themes/page.tsx`)
 * that rebuilds itself at most a minute after anything changes. An action that
 * changes WHICH designs it lists — publishing, archiving, deleting — calls this
 * so the change is there on the next visit instead of up to a minute later.
 * Every locale at once: both lists come from the same rows.
 */
export function revalidatePublicGallery() {
  revalidatePath("/[locale]/themes", "page");
}
