# Fair Share Roulette

Prototype monorepo: **React + Material UI** (`frontend`) and **Express + TypeScript + Prisma** (`backend`). The database defaults to **SQLite** (`backend/prisma/dev.db`) so the app runs with no Postgres install. Optional **OpenRouter** key improves restaurant selection (otherwise picks by `lastVisited`).

**Requirements:** Node.js **18.18+** (recommended **20** — see [`.nvmrc`](.nvmrc)).

## Quick start

From the repo root:

```bash
npm install

# Backend DB (SQLite file created automatically)
cp backend/.env.example backend/.env   # defaults to file:./dev.db → prisma/dev.db
cd backend
npx prisma migrate deploy
npx prisma generate   # rebuild client after schema changes
npm run db:seed
cd ..

npm run dev:backend    # http://localhost:4000
npm run dev:frontend # http://localhost:5173
```

Restart the backend after changing `DATABASE_URL` or running `prisma generate`.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/spinner-options` | Returns 8 restaurants (AI when configured + cuisine spacing). |
| `GET` | `/api/history` | Visit ledger with restaurant and splits. |
| `POST` | `/api/history` | Multipart: `receipt`, `restaurantId`, `totalAmount`, `splits` (JSON string). |

Receipts are stored under `backend/uploads/` and served at `/uploads/...`.

## Workspaces

- [`backend/`](backend/) — Express, Prisma, multer, OpenAI SDK → OpenRouter.
- [`frontend/`](frontend/) — Vite + React + MUI.

To use PostgreSQL instead, switch `provider` in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma), replace SQLite migrations with Postgres migrations, set `DATABASE_URL` accordingly, then `migrate deploy` + `db:seed`.

## License

See [LICENSE](LICENSE).
