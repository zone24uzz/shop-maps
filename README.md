# Logistics Map

A logistics and delivery location dashboard for Tashkent, Uzbekistan. Stores are kept in MongoDB,
served by a read-only REST API and shown on an interactive OpenStreetMap map with search, selection
and a details panel.

This is an MVP. It covers store locations only, and it is structured so courier tracking, orders
and routing can be added without a rewrite (see [Roadmap](#roadmap)).

The interface is in Uzbek (Latin script). Code, comments and documentation are in English.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [MongoDB setup](#mongodb-setup)
- [Running the backend](#running-the-backend)
- [Running the frontend](#running-the-frontend)
- [API](#api)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Production deployment](#production-deployment)
- [Roadmap](#roadmap)

## Features

- Interactive map centred on Tashkent (41.311081, 69.240562) at zoom 12, with zoom, drag, a metric
  scale, "show all stores" and "back to Tashkent" controls.
- One marker per store. Selecting a store, from the map or from the sidebar, flies the camera to it,
  opens a popup with its name, source and coordinates, and highlights it everywhere.
- Sidebar with a scrollable store list and client-side search: case-insensitive, tolerant of the
  different apostrophes used in Uzbek (`o'`, `o‘`, `oʻ`), with a match count and a clear button.
- Summary strip with the figures the data actually supports: total stores, stores visible on the
  map, selected store, city.
- Selected-store bar with coordinates, copy-to-clipboard and an OpenStreetMap link.
- Loading skeletons, empty states, error states with retry, manual refresh. If a refresh fails, the
  last good data stays on screen and is labelled as stale.
- Responsive from phone to desktop, keyboard accessible, honours "reduce motion".
- Backend seeds five demo stores (Chilonzor, Yunusobod, Mirzo Ulug‘bek, Yakkasaroy, Sergeli) into an
  empty database, exactly once. The UI shows a "Demo rejim" badge while demo data is present.
- No paid services and no API keys: map tiles come from OpenStreetMap.

## Tech stack

| Layer    | Technology                                                                            |
| -------- | ------------------------------------------------------------------------------------- |
| Backend  | Node.js, Express 5, Mongoose 9, Zod 4, Helmet, CORS, express-rate-limit, dotenv       |
| Database | MongoDB 8                                                                             |
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5.9 (strict), Tailwind CSS 4            |
| Map      | Leaflet 1.9, React Leaflet 5, OpenStreetMap tiles                                     |
| Icons    | Lucide React                                                                          |
| Tests    | `node:test` + Supertest + mongodb-memory-server, Vitest + Testing Library, Playwright |
| Tooling  | npm workspaces, ESLint 9, Prettier 3, concurrently, Docker Compose (optional)         |

Exact versions are pinned in the `package.json` files and `package-lock.json`.

Two version choices are deliberate:

- **TypeScript 5.9 and ESLint 9**, not the newest majors, because `eslint-config-next` 16 and
  `typescript-eslint` 8 do not support TypeScript 7 or ESLint 10 yet.
- **Vitest 4**, because Vitest 5 does not declare support for Node 25.

## Architecture

```
Browser ──HTTP──> Next.js (port 3000)          serves the dashboard shell
   │
   └──fetch──────> Express API (port 5000) ──Mongoose──> MongoDB (port 27017)
                   GET /api/stores
```

### Backend

Layered, with dependencies pointing inwards:

```
routes ─> middleware (guards) ─> controllers ─> services ─> models ─> MongoDB
                                      │
                         errors bubble up to one error middleware
```

- `config/env.js` validates the environment with Zod and fails fast with a readable message.
- `config/database.js` owns the Mongoose connection: timeouts, retry of the initial connection,
  connection event logging.
- `server.js` is the only file with side effects. It connects to MongoDB, seeds, and only then
  starts listening. `app.js` builds the Express app without side effects, so tests create isolated
  instances.
- `services/` hold the logic. `storeService` maps documents to an explicit public shape, so
  internal fields cannot leak. `seedService` is idempotent (see below).
- `middleware/errorHandler.js` is the single place where errors become responses. Known errors
  (`AppError`) keep their message; everything else is logged and answered with a generic 500.

**Seeding.** The seed runs on every startup and inserts demo stores only when the collection is
completely empty. It only ever inserts; it never updates or deletes. A partial unique index on
`(source, name)` for `source = "demo-seed"` rejects a second copy at the database level, so two
instances starting at the same moment still produce exactly five stores, while real stores remain
free to share names.

**Security.** Helmet headers, CORS restricted to `FRONTEND_URL` and to read methods, a 10 kB body
limit, per-IP rate limiting (the health check is exempt, so monitors can poll it), strict id
validation before any query, `strictQuery` and a strict schema, no write endpoints (write methods
answer 405), no stack traces or driver messages in responses, and the connection string is never
written to the logs.

**Shutdown.** On `SIGINT` or `SIGTERM` the API stops accepting connections, lets requests in flight
finish, tells keep-alive clients to close, then disconnects from MongoDB. Connections still open
after 10 seconds are cut.

### Frontend

```
app/page.tsx (Server Component)
└─ Dashboard (client root: owns stores, search query, selection)
   ├─ AppHeader           status, demo badge, refresh
   ├─ SearchPanel         search input, counts
   ├─ StoreList           list, loading / empty / error states
   ├─ SummaryStrip        the four figures
   └─ MapPanel            'use client'; loads MapView with next/dynamic, ssr: false
      ├─ MapView          Leaflet map, markers, popup, controls
      └─ SelectedStoreBar details of the selected store
```

- **State.** `Dashboard` holds three pieces of state: the loaded stores (`useStores`), the search
  query and the selection. Everything else (visible stores, selected store, counts, notices) is
  derived during render, so the list, the summary and the map cannot disagree.
- **Data.** `useStores` fetches in an effect with an `AbortController`. A response that arrives
  after unmount or after a newer request is ignored. `services/storesApi.ts` validates the response
  with Zod: a malformed envelope is an error; individual bad records are dropped and counted, so
  one broken row cannot take the map down.
- **Leaflet and SSR.** Leaflet touches `window` on import, so `MapView` is loaded with
  `next/dynamic` and `ssr: false` from `MapPanel`, a Client Component. The server render contains a
  placeholder of the same size, which avoids layout shift, and Leaflet ships in its own chunk.
- **Markers.** Inline SVG in a Leaflet `DivIcon`, styled from CSS. This avoids the well-known
  broken default marker images under bundlers, because there are no image files to resolve.
- **Copy.** All interface text lives in `lib/messages.ts`.
- **Design tokens.** Colours, fonts and shadows are defined once in `app/globals.css` (`@theme`).
  Tailwind's default palette is removed, so components can only use the tokens.

## Folder structure

```
logistics-map/
├── backend/
│   ├── scripts/
│   │   ├── dev-mongo.js        development-only embedded MongoDB
│   │   └── mongoBinary.js      MongoDB version for dev and tests
│   ├── src/
│   │   ├── config/             env validation, database connection
│   │   ├── controllers/        HTTP handlers
│   │   ├── data/               demo seed data
│   │   ├── middleware/         error handler, guards, rate limiter, request log
│   │   ├── models/             Mongoose models
│   │   ├── routes/             route definitions
│   │   ├── services/           business logic, seeding
│   │   ├── utils/              AppError, logger, graceful shutdown
│   │   ├── app.js              Express app factory
│   │   └── server.js           entry point
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/                layout, page, error and not-found pages, global CSS
│   │   ├── components/
│   │   │   ├── dashboard/      Dashboard, AppHeader, SummaryStrip
│   │   │   ├── map/            MapPanel, MapView, markers, camera, notices
│   │   │   ├── stores/         SearchPanel, StoreList
│   │   │   └── ui/             Button, Skeleton, StateMessage
│   │   ├── hooks/              useStores, usePrefersReducedMotion
│   │   ├── lib/                constants, env, messages
│   │   ├── services/           API client and response validation
│   │   ├── test/               test fixtures
│   │   ├── types/
│   │   └── utils/              search, formatting, class names
│   ├── .env.example
│   └── package.json
├── e2e/                        Playwright tests
├── docker-compose.yml          MongoDB for local development (optional)
├── playwright.config.ts
└── package.json                workspace root and shared scripts
```

## Requirements

- **Node.js 20.19 or newer.** A current LTS release (22 or 24) is recommended; `.nvmrc` pins 24.
  The project was developed and verified on Node 25.9.
- **npm 10 or newer.**
- **MongoDB**, by any one of these routes:
  - nothing installed: `npm run dev` starts an embedded MongoDB for you (development only);
  - Docker: `docker compose up -d`;
  - a local MongoDB 7 or 8 installation, or a MongoDB Atlas URI.
- **Google Chrome**, only for the end-to-end tests.

## Quick start

```bash
git clone <repository-url> logistics-map
cd logistics-map

npm install

# Create the local environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

npm run dev
```

On Windows PowerShell use `Copy-Item` instead of `cp`.

`npm run dev` starts three processes: MongoDB (only if nothing is listening on port 27017 yet), the
API and the web app. Then open:

- Dashboard: <http://localhost:3000>
- API: <http://localhost:5000/api/stores>

The very first run downloads the MongoDB binary (about 80 MB, once). If the API gives up waiting
during that download, run `npm run dev` again.

## Environment variables

### Backend (`backend/.env`)

| Variable               | Required | Default  | Description                                                     |
| ---------------------- | -------- | -------- | --------------------------------------------------------------- |
| `NODE_ENV`             | yes      |          | `development`, `test` or `production`                           |
| `PORT`                 | yes      |          | API port, `5000` by convention                                  |
| `MONGODB_URI`          | yes      |          | e.g. `mongodb://127.0.0.1:27017/logistics_map`                  |
| `FRONTEND_URL`         | yes      |          | Origin(s) allowed by CORS, comma-separated; no path or wildcard |
| `RATE_LIMIT_MAX`       | no       | `300`    | Requests per IP per window                                      |
| `RATE_LIMIT_WINDOW_MS` | no       | `900000` | Rate-limit window, in milliseconds                              |
| `TRUST_PROXY`          | no       | `0`      | Number of reverse proxies in front of the API                   |
| `DB_CONNECT_RETRIES`   | no       | `5`      | Attempts for the initial MongoDB connection                     |

The API refuses to start if a required variable is missing or malformed and prints which one.

### Frontend (`frontend/.env.local`)

| Variable              | Required | Default                 | Description                         |
| --------------------- | -------- | ----------------------- | ----------------------------------- |
| `NEXT_PUBLIC_API_URL` | no       | `http://localhost:5000` | Base URL of the API, without `/api` |

`NEXT_PUBLIC_` variables are embedded in the browser bundle **at build time**. Never put a secret in
one, and rebuild the frontend after changing it.

Real `.env` files are git-ignored. Only the `.env.example` files are committed.

## MongoDB setup

Pick one. All three listen on `mongodb://127.0.0.1:27017`, which is what `.env.example` expects.

**1. Embedded MongoDB (no installation).**
`npm run dev` runs `npm run db:start`, which starts a real `mongod` process using the official
binary, downloaded and managed by `mongodb-memory-server`. Data persists in `backend/.mongo-data/`.
It is a convenience for development machines, not a mock and not for production. If a MongoDB
server already listens on the port, the script detects it and steps aside.

**2. Docker Compose.**

```bash
docker compose up -d      # start; data persists in the mongo_data volume
docker compose ps         # shows "healthy" once the health check passes
docker compose down       # stop, keep data
```

**3. Local installation or Atlas.**
Install MongoDB Community Server, or create an Atlas cluster, and set `MONGODB_URI` in
`backend/.env`.

To reset the demo data, drop the `stores` collection (or delete `backend/.mongo-data/` when using
the embedded server) and restart the API. The seed then runs again.

## Running the backend

```bash
npm run db:start      # only if you have no other MongoDB running (keeps running)
npm run dev:api       # development, restarts on file changes
npm run start -w backend   # production mode
```

Expected startup log:

```
INFO  MongoDB connected: 127.0.0.1:27017/logistics_map
INFO  Seed complete: inserted 5 demo store(s)      (first run)
INFO  Seed skipped: stores collection is not empty (later runs)
INFO  API listening on http://localhost:5000 (development)
```

## Running the frontend

```bash
npm run dev:web       # development server on http://localhost:3000
npm run build         # production build
npm run start -w frontend   # serve the production build
```

## API

Base URL: `http://localhost:5000`. All responses are JSON. The API is read-only.

| Method | Path              | Description                 |
| ------ | ----------------- | --------------------------- |
| GET    | `/api/health`     | Liveness and database check |
| GET    | `/api/stores`     | All stores, sorted by name  |
| GET    | `/api/stores/:id` | One store by its MongoDB id |

### `GET /api/health`

```json
{ "success": true, "status": "ok" }
```

Answers `503` with the error shape below while MongoDB is unreachable. Not rate limited.

### `GET /api/stores`

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "6acace5d601cb475375280e8",
      "name": "Demo do‘kon: Chilonzor",
      "source": "demo-seed",
      "lat": 41.2756,
      "lng": 69.2034,
      "createdAt": "2026-10-10T23:46:37.386Z",
      "updatedAt": "2026-10-10T23:46:37.386Z"
    }
  ]
}
```

A single response holds at most 1000 stores.

### `GET /api/stores/:id`

```json
{
  "success": true,
  "data": {
    "_id": "6acace5d601cb475375280e8",
    "name": "Demo do‘kon: Chilonzor",
    "source": "demo-seed",
    "lat": 41.2756,
    "lng": 69.2034,
    "createdAt": "2026-10-10T23:46:37.386Z",
    "updatedAt": "2026-10-10T23:46:37.386Z"
  }
}
```

### Errors

Every error has the same shape:

```json
{
  "success": false,
  "error": { "code": "STORE_NOT_FOUND", "message": "Store not found" }
}
```

| Status | Code                     | When                                             |
| ------ | ------------------------ | ------------------------------------------------ |
| 400    | `INVALID_STORE_ID`       | `:id` is not a 24-character hex string           |
| 400    | `INVALID_JSON`           | Request body is not valid JSON                   |
| 400    | `BAD_REQUEST`            | Malformed request, e.g. an undecodable URL       |
| 404    | `STORE_NOT_FOUND`        | No store has this id                             |
| 404    | `ROUTE_NOT_FOUND`        | Unknown path                                     |
| 405    | `METHOD_NOT_ALLOWED`     | Write method on a read-only route                |
| 413    | `PAYLOAD_TOO_LARGE`      | Request body over 10 kB                          |
| 415    | `UNSUPPORTED_MEDIA_TYPE` | Unsupported request body charset or encoding     |
| 429    | `RATE_LIMITED`           | Too many requests from one IP                    |
| 500    | `INTERNAL_ERROR`         | Unexpected failure (details only in server logs) |
| 503    | `DATABASE_UNAVAILABLE`   | MongoDB is unreachable                           |

## Testing

```bash
npm test              # backend and frontend unit/integration tests
npm run test:e2e      # browser tests (needs Chrome; starts the app if it is not running)
npm run lint          # ESLint, both workspaces
npm run typecheck     # TypeScript
npm run format:check  # Prettier
```

- **Backend** (`backend/tests`, `node:test` + Supertest). Each test file starts its own throwaway
  in-memory MongoDB on a random port with a unique database name, so tests never touch development
  or production data. Covered: health, list and single-store responses and their exact shape,
  seeding of an empty database, repeated and concurrent seeding, preservation of real data, invalid
  ids, unknown routes, read-only enforcement, body limits, CORS, security headers, rate limiting,
  the query plan of the list endpoint, a real MongoDB outage with automatic recovery, graceful
  shutdown and environment validation.
- **Frontend** (`frontend/src/**/*.test.ts(x)`, Vitest + Testing Library). Covered: loading,
  rendering of API data, search, selection, empty and error states, retry and refresh, stale data,
  invalid records, response validation, request timeout and cancellation, and the real Leaflet map
  (markers, popup, controls) under jsdom.
- **End to end** (`e2e/`, Playwright, desktop and phone viewports). Drives the real stack: tiles
  centred on Tashkent at zoom 12, one marker per store, popup on marker click, camera movement on
  list selection, search, zoom and drag, layout overflow, API outage with retry, and a clean browser
  console. Screenshots are written to `e2e/screenshots/`.

The e2e suite uses the installed Google Chrome. To use Playwright's own browser instead:

```bash
npx playwright install chromium
E2E_BROWSER_CHANNEL=chromium npm run test:e2e
```

## Troubleshooting

| Symptom                                             | Cause and fix                                                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Startup failed: Invalid environment configuration` | `backend/.env` is missing or incomplete. Copy `backend/.env.example`.                                                                           |
| `Could not connect to MongoDB after 5 attempt(s)`   | Nothing listens on the URI. Run `npm run db:start` or `docker compose up -d`, or fix `MONGODB_URI`.                                             |
| `listen EADDRINUSE ... 5000`                        | Another process uses the port. Stop it or change `PORT` (and `NEXT_PUBLIC_API_URL`).                                                            |
| Dashboard says "API bilan aloqa yo‘q"               | The API is not running, or `NEXT_PUBLIC_API_URL` is wrong. Open <http://localhost:5000/api/health>.                                             |
| Browser console shows a CORS error                  | The page origin is not in `FRONTEND_URL`. `http://localhost:3000` and `http://127.0.0.1:3000` are different origins; list both if you use both. |
| Grey map with markers but no streets                | OpenStreetMap tiles are unreachable (offline, firewall). The app keeps working; the map shows a notice.                                         |
| Changed `NEXT_PUBLIC_API_URL`, nothing happened     | The value is fixed at build time. Restart `npm run dev` or rebuild.                                                                             |
| Demo stores do not appear                           | The seed only runs on an empty collection. See [MongoDB setup](#mongodb-setup) for how to reset.                                                |
| `window is not defined` during build                | Leaflet was imported from server code. Import `MapView` only through `MapPanel`.                                                                |
| Embedded MongoDB fails to start on first run        | The binary download was blocked. Use Docker or a local MongoDB instead.                                                                         |
| `429 RATE_LIMITED` during load tests                | Raise `RATE_LIMIT_MAX` in `backend/.env`.                                                                                                       |

## Production deployment

The MVP runs in production mode (`npm run build`, then `npm run start`), but treat the following as
a checklist before exposing it:

- **Database.** Use a managed or replicated MongoDB with authentication and TLS. Put the
  credentials in `MONGODB_URI` through the platform's secret store. Do not use the embedded
  development MongoDB, and do not expose the Docker Compose service, which has no authentication.
- **Environment.** Set `NODE_ENV=production`, `FRONTEND_URL` to the real site origin, and
  `NEXT_PUBLIC_API_URL` to the public API URL at build time.
- **Proxy and TLS.** Terminate TLS at a reverse proxy or load balancer and set `TRUST_PROXY` to the
  number of proxies, otherwise every client shares one rate-limit bucket.
- **Rate limiting.** The limiter stores counters in memory, per process. With several API
  instances, switch to a shared store such as Redis.
- **Indexes.** Indexes are created at startup, which is fine for small collections. For large ones,
  build indexes in a migration step instead.
- **Demo data.** The seed only fills an empty collection. Import real stores before first start, or
  remove the demo records (`source: "demo-seed"`) afterwards.
- **Map tiles.** The public OpenStreetMap tile servers have a
  [usage policy](https://operations.osmfoundation.org/policies/tiles/) and no SLA. For real traffic
  use a commercial tile provider or self-hosted tiles; the URL is one constant in
  `frontend/src/lib/constants.ts`.
- **Content Security Policy.** The frontend sends basic security headers. Add a CSP that allows the
  API origin and the tile host.
- **Logging and monitoring.** Replace the console logger in `backend/src/utils/logger.js` with a
  structured logger, ship logs, and point an uptime check at `/api/health`.
- **Process management.** Run the API under a supervisor (systemd, PM2, a container orchestrator).
  It shuts down gracefully on `SIGTERM`; give it at least 10 seconds before a hard kill.
- **Node.js.** Run a supported LTS release.

## Roadmap

Planned features and where they attach to the current structure:

| Feature                                 | Where it fits                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| Store management (create, edit, delete) | New write routes behind authentication; `storeService` already isolates persistence        |
| Authentication and role-based access    | Auth middleware in `backend/src/middleware`, applied per router                            |
| Admin dashboard                         | New route group in `frontend/src/app`                                                      |
| Courier accounts, delivery orders       | New model + service + router each, registered in `backend/src/routes/index.js`             |
| Order assignment, route optimisation    | Services on top of orders and couriers; external routing engine behind a service interface |
| Real-time GPS and WebSocket updates     | A socket server next to Express in `server.js`; a live-position layer in `MapView`         |
| Delivery zones                          | GeoJSON polygons with a `2dsphere` index; a polygon layer in `MapView`                     |
| Multiple cities                         | A `city` field on stores and a city switcher; map centre is already a constant             |
| Pagination and geo queries              | `GET /api/stores?bbox=...`; marker clustering on the frontend                              |
| Telegram bot                            | A separate process using the same services                                                 |
| Analytics and reporting                 | Aggregation services; the summary strip is the place for real operational figures          |
| External logistics API integrations     | Adapters in `backend/src/services`, recorded through the store `source` field              |
| Other languages                         | `frontend/src/lib/messages.ts` is the single source of interface text                      |
