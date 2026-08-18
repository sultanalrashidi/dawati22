# PROJECT_MAP — دعوتي (Dawati)

Living architecture doc. Code lives in [`web/`](web/) — see [`web/README.md`](web/README.md) for setup/run instructions and demo accounts. This file lives at the repo root next to the design references (`Card Designs/`, `Designs/` — local-only, gitignored, used as optional inspiration, not copied wholesale).

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack, React 19). Note: `middleware.ts` is renamed `proxy.ts` in v16 — see `web/src/proxy.ts`.
- **DB**: PostgreSQL 16 (local via Homebrew for dev: `brew services start postgresql@16`, db `dawati_dev`) + Prisma 7 (`prisma-client` generator, driver adapter `@prisma/adapter-pg`, config in `web/prisma.config.ts`).
- **Styling**: Tailwind CSS v4 (CSS-first config in `globals.css`) + Base UI (`@base-ui/react`) for complex interactive components — plain elements are hand-styled, not a Base UI skin.
- **i18n**: Hand-rolled `app/[locale]/` routing (`ar` default/RTL, `en`/LTR), dictionaries in `web/src/lib/i18n/dictionaries/*.json`. Guest-facing `/i/[token]` pages are always Arabic/RTL, no locale switch (per spec).
- **Theme (light/dark)**: CSS custom properties + `data-theme` attribute, inline no-flash script, cookie-persisted. The light/dark toggle only affects the **app shell** — the guest invitation page's colors are theme-driven (fixed per invitation theme) and don't respond to it, since a "Royal Palace" dark-luxury card shouldn't flip to white on a light-mode phone.
- **Auth**: Custom phone+OTP sessions (no third-party auth lib). DB-backed sessions (`Session` model, hashed token in httpOnly cookie). OTP via pluggable adapter: mock (dev, code shown on-screen) or Authentica (real SMS) — see `web/src/lib/otp/`.
- **Payments**: Pluggable — mock (dev, instant "paid") or Moyasar (Sandbox/production once keys are set), including webhook signature verification and server-side re-verification of the hosted-form redirect — see `web/src/lib/payments/` and `web/src/lib/orders/service.ts`.

## Architecture

Single Next.js app (`web/`), four surfaces:

1. Customer app — `app/[locale]/(events, plans, themes, checkout)/...`, RTL/LTR, light/dark, mobile-first.
2. Guest experience — `app/i/[token]/...`, standalone root layout, no auth, always `ar`/RTL, opened from a WhatsApp link.
3. Admin panel — `app/[locale]/admin/...`, protected server-side by role.
4. Gate staff scanner — `app/[locale]/gate/...`, protected server-side by role, camera QR scan (`BarcodeDetector` API) with a manual-entry fallback.

**Permissions are enforced server-side**, not by hiding UI: every Server Function calls `requireUserOrThrow(...)` / every protected page calls `requireUserOrRedirect(...)` itself (see `web/src/lib/auth/guards.ts`). `proxy.ts` is intentionally minimal (just the `/` → `/{defaultLocale}` redirect) — Next 16's own guidance warns proxy matchers are easy to silently bypass via refactors, so it's not relied on for auth.

**QR / invitation security**: no sequential IDs. `Invitation.linkToken` and `Invitation.qrToken` are independent 256-bit random tokens (`generateSecureToken()`), unguessable and unrelated to the guest/event ID. Validity is always checked server-side against the DB, never trusted from the client.

**Check-in concurrency**: `performCheckIn()` (`web/src/lib/checkin/service.ts`) deducts a seat via `guest.updateMany({ where: { checkedInCount: { lt: allowedCount } }, data: { increment: 1 } })` inside a transaction — Postgres row-locks the UPDATE, so two simultaneous scans of the last seat can't both succeed. Verified manually against a live scan.

**Theme engine**: themes are rows (`Theme.config: Json`, typed as `ThemeConfig` in `web/src/lib/themes/types.ts`) read by one renderer (`components/guest/invitation-view.tsx`) — adding a theme is a data change, not a new page/component. Editing a theme **already used by a live event** forks a new versioned row and archives the original instead of mutating it in place, so existing guests' invitations never change underneath them (`web/src/lib/admin/themes/service.ts:updateTheme`). Verified manually: editing the in-use "Royal Palace" theme produced `palace-gold` (archived, untouched) + `palace-gold-v2` (published), with the existing event still pointing at the original.

**Theme preview**: `components/themes/theme-preview-dialog.tsx` renders the real `InvitationView` in a Base UI `Dialog`, fed with sample content (no DB record needed) via a `mode="preview"` prop — RSVP is simulated client-side only (never calls `submitRsvpAction`), and the accepted-state QR is a decorative local placeholder (`FakeQr`) rather than a server-generated one. Wired into the admin theme editor (live form state, updates as you edit), the public `/themes` gallery, and the event-creation theme picker — this is how "see and choose" / "see and preview" actually works, not the small static swatch card alone.

**Client/server boundary gotcha worth remembering**: never import `@/generated/prisma/client` (even just for an enum) into a `"use client"` file — it pulls the whole Prisma runtime into the browser bundle and produced a genuine Turbopack build panic (`chunking context does not support external modules (request: node:module)`) during this build. Client components that need an enum-shaped value use a local plain string-union type instead (see `components/gate/gate-scanner.tsx`'s `GuestFacingStatus`-style pattern, and the fix applied to `theme-status-actions.tsx`).

## Data model (Prisma — `web/prisma/schema.prisma`)

`User` (role: CUSTOMER/ADMIN/GATE_STAFF), `Session`, `OtpCode` · `Plan`, `Order` · `Theme`, `ThemeAsset`, `ClientAssignedTheme` · `Event` · `Guest`, `Invitation`, `Rsvp` · `GateStaff`, `GateStaffAssignment`, `CheckInLog` · `GuestManagementRequest`, `Notification`, `AuditLog`.

`Invitation.status` holds the delivery/RSVP lifecycle the app actually writes (DRAFT/SENT/VIEWED/ACCEPTED/DECLINED/BLOCKED/CANCELLED); the entry-validity refinements (VALID/PARTIALLY_USED/FULLY_USED/EXPIRED) are valid enum members reserved for admin override / gate-scan display rather than written automatically, since they're derived from seat counts + expiry at read time.

## Roles & permissions

| Action | Customer | Gate staff | Admin |
|---|---|---|---|
| Buy a plan / create an order | ✅ (own) | ❌ | — (admin plan/price management instead) |
| Create/edit own event | ✅ (after a PAID order) | ❌ | ✅ (any, via admin panel) |
| Manage own guests/invitations | ✅ | ❌ | — (view only in this pass) |
| Scan QR / check in | ❌ | ✅ (assigned events only) | ✅ (any) |
| Manage plans, themes, users, gate staff | ❌ | ❌ | ✅ |

## MVP scope — status

**Done, built, and manually verified end-to-end** (phone → OTP → session; plan → mock-paid order → gated event creation; guest add → secure link/QR → WhatsApp share; guest RSVP page → accept → digital pass with real QR; gate manual-entry scan → atomic seat deduction → denial states; admin plan price edit; admin theme edit with versioning-safe fork):

- Phone+OTP auth for all three roles, rate-limited, codes hashed at rest, never logged.
- Plans catalog + mock checkout → Order; Moyasar adapter fully implemented (payment creation verification, webhook signature check) but unexercised without live keys.
- Event CRUD gated on a paid order; guest CRUD with per-guest seat counts; secure invitation tokens; WhatsApp share link.
- `/i/[token]` guest page: theme-driven cover + reveal animation, live countdown, RSVP, digital pass with QR, `prefers-reduced-motion` respected via global CSS.
- Theme engine: **43** real themes spanning all 4 layouts (`classic-center`, `arch-frame`, `envelope-reveal`, `split-portrait`) and all 6 motion styles (`fade`, `arch-reveal`, `envelope`, `curtain`, `gate-swing`, `seal-break`) — every theme has a distinct (layout, motion, palette, font) combination. The original 10 (Royal Palace, Modern Minimal, Garden Estate, Velvet Midnight, Black Tie, Desert Rose, Modern Najdi, Dusty Rose Editorial, Pearl Luster, Royal Espresso) plus all 33 additional themes from the `Card Designs/dawati_40_theme_expansion_specs.md` reference doc, at the user's request to add every available design from that file. Category breakdown (verified via `SELECT category, count(*) FROM "Theme" GROUP BY category`): botanical:1, dark:5, experimental:5, luxury:11, minimal:11, romantic:5, saudi:5. 8 Google Fonts loaded (added Playfair Display + Tajawal). A full interactive preview (see below) is reachable from every theme card, not just a color swatch.
- `/gate` scanner: camera (`BarcodeDetector`, gracefully degrades) + manual entry, race-safe check-in, all denial states (full/blocked/cancelled/expired/unconfirmed/invalid).
- `/admin`: dashboard metrics, users (block/unblock), events (view/cancel), orders (view), plans (full CRUD + status), gate staff (view), and a full theme/design manager (color/font/layout/motion/section editor, image upload with type/size validation, publish/hide/archive/restore/duplicate/delete, per-event assignment, versioning-safe edits).
- Public `/themes` gallery and `/plans` page for pre-purchase browsing.
- Optional background music: customer pastes a YouTube link at event creation (`Event.musicYoutubeId`, extracted/validated via `lib/youtube.ts`); the guest page never autoplays — a vinyl-icon toggle (`MusicToggle` in `invitation-view.tsx`) shows only when a link was set, and starts a hidden `youtube-nocookie.com` iframe via `postMessage` only on click.
- Category decoration kits (`components/guest/theme-decor.tsx`): one hand-authored SVG motif kit per `Theme.category` (luxury/minimal/saudi/romantic/botanical/dark/experimental), rendered behind the card content in each theme's own accent color, with a subtle floating/swaying CSS animation — gives all 43 themes a distinct decorative layer without per-theme artwork.
- Richer envelope-open interaction: themes with `motion.openStyle` of `"envelope"` or `"seal-break"` show a wax-seal badge instead of a plain button; clicking plays a crack/fold animation (`dawati-seal-crack` CSS keyframe) before the reveal.

**Explicitly deferred** (see `web/README.md` for the full list): live Moyasar/Authentica traffic (real code, needs real env keys), Mada/Apple Pay (shown as "coming soon", same Moyasar integration point), an automated test suite (verification here was a manual tool-driven pass through every surface + a Postgres-level check after each), and a couple of smaller admin conveniences not in the original spec text (e.g. customer-facing guest-management-request review queue, in-app notification delivery beyond the DB record).

**Bugs found and fixed during manual verification** (kept here since they're the kind of thing worth re-checking after similar changes):
- Login form mapped every non-`invalid_code` OTP error to "invalid phone", so a blocked account showed a misleading message instead of "account blocked" — fixed by matching all three `OtpSubmitResult` error variants explicitly (`components/auth/login-form.tsx`).
- `ThemePreviewDialog`'s trigger wrapped a `<button>` inside `Dialog.Trigger`'s own `<button>` — invalid HTML that Base UI/React flagged as a hydration error and which silently broke click handling. Fixed with Base UI's `render` prop (`Dialog.Trigger render={<button>...} />`) instead of children — this is the correct pattern any time a Base UI trigger/close needs to render as a caller-supplied element.
- The `/themes` gallery mounted one independent `Dialog.Root` **per theme card** (43 of them at once) — clicking one theme's preview button would sometimes open a different theme's content, or nothing, reproducible in both dev and production builds. Root cause: too many simultaneously-mounted Base UI dialog instances, not an HMR/dev artifact. Fixed by refactoring to the single-shared-dialog pattern already used correctly in `ThemePicker`: `ThemeGalleryCard` (`components/themes/theme-gallery-card.tsx`) is now presentational-only (`onPreview` callback, no `Dialog` inside it), and a new `ThemeGalleryGrid` (`components/themes/theme-gallery-grid.tsx`) holds one `previewId` state + one `ThemePreviewDialog` instance for the whole grid. **Rule of thumb**: never mount one modal instance per list item — hold one shared dialog instance keyed by a selected-id state instead.
- Once the dialog above became shared/reused across theme switches, `InvitationView`'s internal cover/RSVP state leaked across previews — previewing theme A through to "accepted", then switching to theme B, showed B already in the accepted/pass state. Fixed by adding a `previewKey` prop to `ThemePreviewDialog` (passed as the theme's `id` from both call sites) applied as `key={previewKey}` on `InvitationView`, forcing a clean remount on every theme switch. Verified: opening theme A → accept RSVP → close → open theme B now correctly starts at the cover screen.

## [ORPHANS & PENDING]

**Product decision, explicit**: no photo upload for the couple anywhere in the invitation — decoration is illustrative/vector only (see theme-decor.tsx), never a real photo of any bride/groom. Don't reintroduce a photo-upload feature without re-confirming with the user.

Nothing blocking — the four surfaces are wired end-to-end. Remaining polish, in priority order if continuing:

- Admin: let admins manage guests/gate-staff directly on someone else's event (currently admin can view/cancel events but guest-level management is customer-only).
- `GuestManagementRequest` flow (customer asks admin to manage their guest list) has a DB model but no UI yet.
- `Notification` model exists but nothing writes to it yet — no in-app notification center.
- Live-payment and live-SMS paths need real Moyasar/Authentica credentials to exercise (adapters are complete).
