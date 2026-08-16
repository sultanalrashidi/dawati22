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
pnpm db:seed                  # admin + gate-staff accounts, plans, themes
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

Auth is phone + OTP for every role. With no `AUTHENTICA_API_KEY` set, OTP codes are **not sent anywhere** — the login screen displays the code directly ("وضع تجريبي — رمز التحقق"), so any of these numbers can be used to sign in locally:

| Role | Phone |
|---|---|
| Admin | `0500000001` |
| Gate staff | `0500000002` |
| Customer | any new number — first login creates the account |

## Environment variables

See `.env.example` for the full list. Everything payment/SMS-related is optional in dev — leaving it unset switches to a local mock adapter, never a live call:

- `DATABASE_URL` — Postgres connection string.
- `SESSION_SECRET` — used for session bookkeeping; set a real random value in production.
- `AUTHENTICA_API_KEY` — set to send real SMS via [Authentica](https://authentica.sa). Unset ⇒ mock adapter (code shown on-screen).
- `MOYASAR_SECRET_KEY` / `MOYASAR_PUBLISHABLE_KEY` / `MOYASAR_WEBHOOK_SECRET` — set to enable [Moyasar](https://moyasar.com) checkout (Sandbox or live keys). Unset ⇒ mock "pay now" flow that marks the order paid instantly, for exercising the rest of the product without a payment gateway.
- `NEXT_PUBLIC_APP_URL` — used to build guest invitation links (`/i/[token]`) and Moyasar callback URLs.

## What's built vs. deferred

**Built and working end-to-end** (see [`PROJECT_MAP.md`](../PROJECT_MAP.md) for detail): phone+OTP auth, plan purchase → order → gated event creation, guest management with per-guest seat counts, cryptographically random (non-sequential) invitation links/QR tokens, the guest RSVP page with a live countdown and digital pass, gate check-in with an atomic, concurrency-safe seat deduction (verified under a simulated double-scan), a data-driven theme engine with three genuinely distinct starter themes (different layout, fonts, palette, and opening animation — not just recolors), and an admin panel covering users/events/orders/plans/gate staff plus a full theme manager (color/font/layout/motion/section editor, image upload, publish/hide/archive/restore, per-event theme assignment, and **versioning-safe edits** — editing a theme already used by a live event forks a new version instead of changing what existing guests see).

**Deferred** (adapters are real and switch on automatically the moment env keys are set — nothing here is a stub, they're just unexercised without credentials):

- Live Moyasar payments and Authentica SMS — both adapters are fully implemented (including Moyasar webhook signature verification and server-side payment re-verification) but untested against real endpoints in this environment.
- Mada / Apple Pay — shown as "coming soon" in checkout; wire up via the same Moyasar `methods` array once card payments are verified live.
- The theme library ships with 3 real themes proving the engine (arch-frame/dark-luxury, classic-center/minimal, envelope-reveal/botanical); expanding to the full 15–40 is now purely an admin-panel content task, not an engineering one.
- Automated test suite — verification so far has been a manual, tool-driven pass through every surface (see below); no unit/e2e tests are checked in yet.

## Running checks

```bash
pnpm build   # type-checks + production build
pnpm lint
```
