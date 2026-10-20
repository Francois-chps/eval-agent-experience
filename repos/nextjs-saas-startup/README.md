# Tablo

Team scheduling for independent restaurants.

Tablo helps restaurant managers plan shifts, share schedules with their team
and stop juggling spreadsheets and group chats. We are a small team based in
Lyon, working with about 180 restaurants in France and Belgium.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) with React and TypeScript in strict mode
- Plain CSS with custom properties, no UI framework
- Password hashing with `scrypt` from `node:crypto`
- Cookie-based sessions stored server-side

Data currently lives in an in-memory store (`lib/db.ts`), so accounts created
locally are lost when the server restarts.

## Getting started

Requirements: Node.js 22 (see `.nvmrc`).

```bash
npm ci
npm run dev
```

Then open http://localhost:3000.

A demo account is created on startup:

| Email                | Password   |
| -------------------- | ---------- |
| `demo@tablo.example` | `demo1234` |

## Scripts

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the development server         |
| `npm run build`     | Create a production build            |
| `npm run start`     | Serve the production build           |
| `npm run typecheck` | Type-check the project with `tsc`    |

## Project structure

```
app/
  api/auth/        Signup, login and logout route handlers
  dashboard/       Authenticated dashboard (server component)
  login/, signup/  Public auth pages (plain HTML forms)
  layout.tsx       Root layout and header
  globals.css      Global styles
lib/
  db.ts            In-memory data store and data access functions
  auth.ts          Session cookie helpers
  password.ts      Password hashing and verification
```

## Conventions

- Shared server-side code lives in `lib/` and is imported with the `@/` alias
  (for example `import { getCurrentUser } from "@/lib/auth"`).
- Pages and routes never touch the store directly: they go through the
  functions exported by `lib/db.ts`.
- Forms post to route handlers, which redirect with a `303` status.
