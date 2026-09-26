# دعوتي (Dawati)

A premium Arabic-first digital invitations & event platform. Next.js 16 (App Router) + PostgreSQL + Prisma 7, built as a single app serving four surfaces:

- **Customer app** — browse plans, buy one, create an event, manage guests, share invitation links.
- **Guest experience** (`/i/[token]`) — a standalone, no-login, Arabic/RTL invitation page opened from a WhatsApp link: cover animation → details/countdown → RSVP → digital pass with QR.
- **Admin panel** (`/admin`) — users, events, orders, plans/pricing, gate staff, and a full theme/design manager.
- **Gate staff scanner** (`/gate`) — camera QR scan (with manual-entry fallback) and atomic, race-safe check-in.

See [`../PROJECT_MAP.md`](../PROJECT_MAP.md) for the architecture doc and what's still open.

## Stack

Next.js 16 (Turbopack, React 19) · PostgreSQL 16 + Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`) · Tailwind CSS v4 · Base UI · custom phone+OTP auth (no third-party auth lib) · pluggable Moyasar/mock payments and Authentica/mock OTP.

## Setup

**Prerequisites:** Node 20+, pnpm, PostgreSQL 16 running locally (or reachable via `DATABASE_URL`).

```bash
# from web/
cp .env.example .env        # edit DATABASE_URL if not using the default below
pnpm install                 # also runs `prisma generate` (postinstall)
pnpm db:migrate               # applies the schema
pnpm db:seed                  # pricing + themes (SEED_DEMO_ACCOUNTS=true adds local demo accounts)
pnpm dev                      # http://localhost:3000
```

If you don't have Postgres running yet:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb dawati_dev
```

Default `.env` value: `DATABASE_URL="postgresql://<your-user>@localhost:5432/dawati_dev?schema=public"`.

## Demo accounts

Auth is phone + OTP for every role. With no `AUTHENTICA_API_KEY` set, OTP codes are **not sent anywhere** — the login screen displays the code directly ("وضع تجريبي — رمز التحقق").

`pnpm db:seed` creates **no accounts** by default. For local work, run `SEED_DEMO_ACCOUNTS=true pnpm db:seed` (refused when `NODE_ENV=production`):

| Role | Phone | How to sign in |
|---|---|---|
| Admin | `0500000001` | Private admin route only. Created with **no password**: the seed prints a single-use enrollment token (24h) — type it in the password field, then the on-screen code, then choose a password. |
| Gate staff | `0500000002` | Public sign-in with the on-screen code. |
| Customer | any new number | Public sign-in — the first login creates the account. |

### Admin accounts on a real database

Admins are created and recovered only with the operator command, never by the seed:

```bash
pnpm admin:accounts list                                   # read-only audit of ADMIN / GATE_STAFF rows
pnpm admin:accounts enroll 05XXXXXXXX --name "الاسم"        # new admin: prints a single-use token (24h)
pnpm admin:accounts enroll 05XXXXXXXX --reset-password     # recovery: new token, old password + sessions revoked
pnpm admin:accounts revoke 05XXXXXXXX --confirm            # demote to customer, end all sessions
```

An admin without a password can only sign in with an unexpired enrollment token **and** the SMS code, and must set a password in that same sign-in. Every enrollment and revocation is written to `AuditLog`.

If an earlier `db:seed` created the fixed demo admin (`+966500000001`) or gate account (`+966500000002`) on a shared or production database, `list` flags them: enroll a real operator first, then `revoke` each demo number.

## Environment variables

See `.env.example` for the full list. Everything payment/SMS-related is optional in dev — leaving it unset switches to a local mock adapter, never a live call:

- `DATABASE_URL` — Postgres connection string.
- `SESSION_SECRET` — signs preview-share grants; set a real random value (32+ characters) in production. Unset or shorter than 16 characters ⇒ share links refuse to issue grants.
- `AUTHENTICA_API_KEY` — set to send real SMS via [Authentica](https://authentica.sa). Unset ⇒ mock adapter (code shown on-screen).
- `MOYASAR_SECRET_KEY` / `MOYASAR_PUBLISHABLE_KEY` / `MOYASAR_WEBHOOK_SECRET` — set to enable [Moyasar](https://moyasar.com) checkout (Sandbox or live keys). Unset in development ⇒ mock "pay now" flow that marks the order paid instantly, for exercising the rest of the product without a payment gateway. Unset in any built deployment (`NODE_ENV=production`, previews included) ⇒ checkout refuses; the mock is never offered there.
- `NEXT_PUBLIC_APP_URL` — used to build guest invitation links (`/i/[token]`) and Moyasar callback URLs.

## What's built vs. deferred

**Built and working end-to-end** (see [`PROJECT_MAP.md`](../PROJECT_MAP.md) for detail): phone+OTP auth, plan purchase → order → gated event creation, guest management with per-guest seat counts, cryptographically random (non-sequential) invitation links/QR tokens, the guest RSVP page with a live countdown and digital pass, gate check-in with an atomic, concurrency-safe seat deduction (verified under a simulated double-scan), a data-driven theme engine with 47 genuinely distinct themes (different layout, fonts, palette, and opening animation — not just recolors) across 7 categories, each with its own SVG decoration kit, a wax-seal or 3D-door open interaction depending on the theme's motion style, optional click-to-play YouTube background music per event (never autoplays), a raw-WebGL animated shader background on one theme, and an admin panel covering users/events/orders/plans/gate staff plus a full theme manager (color/font/layout/motion/section editor, image upload, publish/hide/archive/restore, per-event theme assignment, and **versioning-safe edits** — editing a theme already used by a live event forks a new version instead of changing what existing guests see).

**Deferred** (adapters are real and switch on automatically the moment env keys are set — nothing here is a stub, they're just unexercised without credentials):

- Live Moyasar payments and Authentica SMS — both adapters are fully implemented (including Moyasar webhook signature verification and server-side payment re-verification) but untested against real endpoints in this environment.
- Mada / Apple Pay — shown as "coming soon" in checkout; wire up via the same Moyasar `methods` array once card payments are verified live.
- The theme library ships with 47 themes (the original 10, 33 from the theme-expansion reference doc, and 4 more ported from `designd2/` mockups — see `PROJECT_MAP.md`); adding further themes beyond that is purely an admin-panel content task, not an engineering one.
- Automated test suite — verification so far has been a manual, tool-driven pass through every surface (see below); no unit/e2e tests are checked in yet.

## Running checks

```bash
pnpm build   # type-checks + production build
pnpm lint
```
