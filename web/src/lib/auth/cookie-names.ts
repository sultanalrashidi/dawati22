/**
 * The two sign-in cookies, named in one place because three different worlds
 * need them: the server session code, the browser header, and next.config.ts
 * (whose gallery rewrite keys off the session cookie's presence). Names only —
 * nothing here is secret.
 */

/** HttpOnly, the real credential. See `session.ts`. */
export const SESSION_COOKIE = "dawati_session";

/** Readable, the role only, grants nothing. See `session-hint.ts`. */
export const SESSION_HINT_COOKIE = "dawati_role";
