# Insiders Ushering Management System

An event-staffing operations platform for managing ushers, events, assignments, attendance, balances, and performance.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/admin-app` — desktop-oriented admin operations app
- `artifacts/ushers-app` — mobile-first usher portal
- `artifacts/api-server` — Express API service
- `lib/db/src/schema` — Drizzle/PostgreSQL schema
- `lib/api-spec` — OpenAPI source of truth
- `artifacts/*/src/index.css` — app-specific Insiders brand tokens and global styles

## Architecture decisions

- The admin and usher experiences remain separate web apps while sharing the generated API client and backend.
- The Insiders visual system is implemented at each app's theme layer so existing page behavior and routes remain unchanged.
- The apps use cream/charcoal/forest-green tokens with Anton display headings and Cairo body/UI text to match the provided brand manual.

## Product

- Admins manage ushers, events, broadcasts, audit logs, and staffing operations.
- Ushers register, review assignments, check in/out, track balances, receive notifications, and view their event history.

## User preferences

- Preserve existing functionality while applying the Insiders brand identity consistently across both apps.

## Gotchas

- Frontend preview services are managed through each artifact's `.replit-artifact/artifact.toml`; use the exact artifact workflow names when restarting.
- The API requires `PORT` and a configured `DATABASE_URL` to run.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
