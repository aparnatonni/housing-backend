# housing-backend

Housing & Roommate Management Platform — backend API built with Express 5, TypeScript, Prisma (PostgreSQL), and Zod validation.

## Stack

- Node.js + TypeScript (strict mode)
- Express 5
- Prisma ORM + PostgreSQL (Neon)
- JWT auth (short-lived access + rotating refresh tokens), bcrypt password hashing
- Google OAuth sign-in via `google-auth-library`
- Cloudinary image uploads via Multer
- Zod request validation
- Biome for linting/formatting
- Helmet, CORS, express-rate-limit

## Quick start

```bash
npm install          # installs deps + runs prisma generate
cp .env.example .env # then fill in DATABASE_URL + JWT secrets
npm run prisma:migrate   # prisma migrate dev
npm run prisma:seed      # seed demo users (prints ADMIN credentials)
npm run dev
```

Server runs on `http://localhost:5000` (PORT from `.env`). All endpoints under `/api/v1`.

## Environment variables

| Variable                | Description                                                    | Default |
| ----------------------- | -------------------------------------------------------------- | ------- |
| `PORT`                  | HTTP port                                                      | `5000`  |
| `NODE_ENV`              | `development` / `production`                                   | dev     |
| `DATABASE_URL`          | PostgreSQL connection string (Prisma)                          | —       |
| `JWT_ACCESS_SECRET`     | Secret used to sign short-lived access tokens                  | —       |
| `JWT_REFRESH_SECRET`    | Secret used to sign rotating refresh tokens                    | —       |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime (e.g. `15m`)                             | `15m`   |
| `JWT_REFRESH_EXPIRES_IN`| Refresh token lifetime (e.g. `7d`)                             | `7d`    |
| `GOOGLE_CLIENT_ID`      | Google OAuth 2.0 web client ID (for `/auth/google`)            | —       |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (for property image uploads)             | —       |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                                             | —       |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                                          | —       |
| `CORS_ORIGIN`           | Allowed CORS origin                                            | `*`     |
| `RATE_LIMIT_WINDOW_MS`  | Rate-limit window                                              | 15 min  |
| `RATE_LIMIT_MAX`        | Max requests per window                                        | `100`   |

`JWT_*` secrets must be set for authentication to work. In production use long random values, e.g. `openssl rand -hex 48`.

## Authentication endpoints

All under `/api/v1/auth`:

| Method | Path             | Auth     | Description                                    |
| ------ | ---------------- | -------- | ---------------------------------------------- |
| POST   | `/register`      | public   | Create account (role `TENANT` or `OWNER` only) |
| POST   | `/login`         | public   | Login with email + password                    |
| POST   | `/refresh-token` | public   | Rotate refresh token, get new access token     |
| POST   | `/logout`        | public   | Revoke current refresh token                   |
| POST   | `/google`        | public   | Login/register with a Google ID token          |
| GET    | `/me`            | `protect`| Return the authenticated user                  |

- Access tokens are returned in the JSON body.
- Refresh tokens are also set as an `httpOnly` cookie scoped to `/api/v1/auth` and stored **hashed** (sha256) in the `refresh_tokens` table; rotation revokes the previous token.
- Responses follow the standard shape:
  - success: `{ success: true, message, data }`
  - error: `{ success: false, message, errors }`

### Example

```bash
curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@housing.com","password":"Password123!"}'

curl -s http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Google OAuth login (Google Cloud Platform)

`POST /api/v1/auth/google` accepts a Google **ID token** (JWT issued by Google after the client-side sign-in flow) and verifies it server-side with `google-auth-library`.

### How it works

1. The frontend (e.g. a React SPA or mobile app) runs the Google "Sign in with Google" flow and receives an ID token.
2. The client sends `{ "idToken": "<google_id_token>" }` to `POST /api/v1/auth/google`.
3. The backend verifies the token signature, audience, and expiry against its own `GOOGLE_CLIENT_ID` using `OAuth2Client#verifyIdToken`.
4. If the verified Google account's email already exists in the `users` table, the user is logged in (and their `googleId` is linked if it was a previously local account).
5. If not, a new user is created with `provider = GOOGLE`, `isVerified = true`, and no password hash — after which they can log in with Google forever.
6. On success the standard `{ success, message, data }` response is returned with the access + refresh tokens (refresh also set as httpOnly cookie).

> Only users whose Google email is **verified** (Google's `email_verified` claim) are accepted.

### Setting it up in GCP

1. Go to [Google Cloud Console](https://console.cloud.google.com) → select/create a project.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**.
3. Enter an authorized JavaScript origin (e.g. `http://localhost:3000` for the web app) and authorized redirect URIs (for the sign-in flow).
4. Copy the generated **Client ID** (the client secret is NOT needed by the backend — ID tokens are verified with the public keys from Google's cert/jwks endpoint).
5. Set `GOOGLE_CLIENT_ID=<your-client-id>` in `.env` and restart the server.

The backend only needs the Client ID because it validates ID tokens using Google's public JWKS — no API key or client secret round-trip is required.

## Properties & Rooms endpoints

Owners manage their own listings; tenants and the public can browse. All mutation routes require `protect` + `authorize("OWNER")`, and ownership is enforced per-row (403 for non-owners, 404 for missing/soft-deleted resources).

| Method | Path                          | Auth                    | Description                                   |
| ------ | ----------------------------- | ----------------------- | --------------------------------------------- |
| GET    | `/properties`                 | public                  | Paginated list with filters (see below)       |
| GET    | `/properties/:id`             | public                  | Property details including its rooms + owner  |
| POST   | `/properties`                 | `OWNER`                 | Create a property                             |
| PATCH  | `/properties/:id`             | `OWNER` (owner)         | Update own property                           |
| DELETE | `/properties/:id`             | `OWNER` (owner)         | Soft-delete own property                      |
| GET    | `/properties/my-properties`   | `OWNER`                 | Paginated list of the owner's own listings    |
| POST   | `/properties/:id/rooms`       | `OWNER` (owner)         | Add a room to own property                    |
| POST   | `/properties/:id/images`      | `OWNER` (owner)         | Upload images (Multer + Cloudinary)           |
| PATCH  | `/rooms/:id`                  | `OWNER` (owner)         | Update a room of own property                 |
| DELETE | `/rooms/:id`                  | `OWNER` (owner)         | Soft-delete a room                            |

### List filters (`GET /properties`)

- `page`, `limit` — pagination (default `1`, `20`; limit max 100)
- `city` — case-insensitive city match
- `minRent`, `maxRent` — properties that have at least one non-deleted room with `rentAmount` in range
- `propertyType` — `APARTMENT` / `HOUSE` / `STUDIO` / `CONDO` / `TOWNHOUSE`
- `search` — case-insensitive match on `title` or `address`
- `sortBy` — `newest` (default), `oldest`, `price_asc`, `price_desc`

List items include `roomCount` and `minRent` (cheapest non-deleted room) instead of the full `rooms[]`. Price sorting is computed server-side from `minRent`.

Soft-deleted properties/rooms and `INACTIVE` properties are never returned by public endpoints. `DELETE` removes listings permanently from view (soft delete via `deletedAt`).

### Image upload

`POST /properties/:id/images` accepts multipart form data with field `images` (up to 10 files, each ≤ 5MB, image/* only). Files are uploaded to Cloudinary and their secure URLs are appended to the property's `images` array. Set `CLOUDINARY_*` env vars; the endpoint returns `503` if not configured.

## Commands

```bash
npm run dev            # dev server with watch (tsx)
npm run build          # type-check + compile to dist/
npm run start          # run compiled dist/server.js
npm run lint           # biome check --write src
npm run format         # biome format --write src
npm run prisma:migrate # create + apply a migration
npm run prisma:deploy  # apply committed migrations
npm run prisma:seed    # seed demo data
npm run prisma:studio  # open Prisma Studio
```