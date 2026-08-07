# Phase 1 — Application Foundation

## Goal

Add authenticated product foundation without changing marketing homepage behavior.

## Status

**Complete** (build passing)

## Delivered

- Route groups: `app/(marketing)` vs `app/app` + `app/auth`
- Extended design tokens for product UI
- Shared `BrandLogo`
- Sandbox OTP auth (`/auth/login`, OTP=`123456`)
- Onboarding slides (`/auth/onboarding`)
- AppShell (desktop right nav + mobile bottom nav)
- Dashboard with simulation-labeled demo data
- Core `/app/*` route stubs
- PWA manifest foundation
- Homepage preserved at `/`

## How to try

1. `npm run dev`
2. Open `/auth/login`
3. Phone: any `09xxxxxxxxx`
4. OTP: `123456`
5. Complete/skip onboarding → `/app/dashboard`

## Next

Phase 2 — Core financial model (Prisma, ledger, quotes, fees, mock providers + tests)
