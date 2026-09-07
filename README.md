# housing-backend

Housing & Roommate Management Platform — backend API built with Express 5, TypeScript, Prisma (PostgreSQL), and Zod validation.

## Overview

A full-stack backend for a housing & roommate management platform. Property owners list properties and rooms, browse for applicants, approve applications (which atomically creates an active tenancy), manage maintenance requests, and generate rent payments. Tenants browse listings, request viewings, apply for rooms, split household bills with roommates, raise maintenance requests, and pay rent/bill shares through SSLCommerz. Admins get platform-wide dashboards, user management, and audit logs.

Key capabilities:

- JWT auth with rotating (revoked-on-use) refresh tokens, httpOnly refresh cookie, and Google OAuth sign-in
- Public property/room discovery with multi-filter search, pagination, and price sorting
- Race-safe application approval (single interactive transaction: claim → room unavailable → auto-reject competitors → create tenancy)
- Rent payment generation, bill splitting across roommates, and SSLCommerz payment flows (initiate → hosted checkout → validated success/IPN callbacks)
- Maintenance request lifecycle (OPEN → IN_PROGRESS → RESOLVED → CLOSED) with image uploads
- Soft deletes (`deletedAt`) throughout; deleted/inactive resources are never served
- Transactional email notifications (SMTP) sent best-effort after DB transactions commit
- Redis caching for the public listing endpoint (60s TTL, `X-Cache` header, cache invalidation)
- Audit logging and in-app notifications on every status change
- Rate limiting, helmet, and CORS hardening

## Architecture

```
Client (SPA / mobile / Postman)
        │
        ▼
   Express 5 app (src/app.ts)
   helmet · cors · express.json · cookie-parser · rate-limit
        │
        ▼
   Routers (src/modules/*/*.routes.ts)  ──  mounted under /api/v1
        │
        ▼
   middlewares: protect (JWT) → authorize (role) → requireUUID
        │
        ▼
   Validators (Zod) ──▶ Controllers (src/modules/*/*.controller.ts)
                             │
                             ▼
                      Services (src/modules/*/*.service.ts)
                             │
               ┌─────────────┼──────────────┐
               ▼             ▼              ▼
           PostgreSQL     Redis        SMTP / nodemailer
           (Prisma ORM)   (cache)      (src/lib/mailer.ts)
        └── Cloudinary (image uploads)
```

```
src/
├── app.ts                      # express app: middleware + router mounting
├── server.ts                   # bootstrap & graceful shutdown
├── config/index.ts             # env parsing + typed config
├── constants/index.ts          # enums (roles, statuses, etc.)
├── middlewares/                # errorHandler, protect, authorize, requireUUID, rateLimit
├── utils/                      # ApiResponse helpers (sendSuccess/sendError), asyncHandler, token utils
├── lib/                        # mailer.ts (SMTP), cache.ts (Redis)
├── modules/
│   ├── auth/          routes · controller · service · validation
│   ├── users/         profile, roommatePreference, change password
│   ├── properties/    properties + rooms (list incl. cache)
│   ├── viewing-requests/
│   ├── applications/
│   ├── tenancies/
│   ├── rent-payments/
│   ├── bill-splits/
│   ├── maintenance/
│   ├── payments/      SSLCommerz parent
│   └── admin/         dashboard, audit logs, user/property moderation
└── prisma/                     # schema, migrations, seed
```

Request flow: **Route → (middlewares) → Zod validation → Controller → Service → DB/Redis/SMTP → standard JSON envelope**. Controllers stay thin; business logic and transactions live in services. All responses go through `utils` helpers, so every endpoint returns the same shape — success `{ success, message, data }` and error `{ success, message, errors }`.

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

### Demo accounts

The seed creates six users (all password `Password123!`):

| Role  | Email                  | Name           |
| ----- | ---------------------- | -------------- |
| ADMIN | `admin@housing.com`    | Platform Admin |
| OWNER | `owner1@housing.com`   | Alice Owner    |
| OWNER | `owner2@housing.com`   | Bob Landlord   |
| TENANT| `tenant1@housing.com`  | Carol Tenant   |
| TENANT| `tenant2@housing.com`  | Dave Renter    |
| TENANT| `tenant3@housing.com`  | Eve Seeker     |

The admin credentials are also printed by `npm run prisma:seed`.

## Environment variables

| Variable                | Description                                                    | Default |
| ----------------------- | -------------------------------------------------------------- | ------- |
| `PORT`                  | HTTP port                                                      | `5000`  |
| `NODE_ENV`              | `development` / `production`                                   | dev     |
| `DATABASE_URL`          | PostgreSQL connection string (Prisma). Use the direct Neon host (no `-pooler`) so interactive transactions stay consistent. | —       |
| `JWT_ACCESS_SECRET`     | Secret used to sign short-lived access tokens                  | —       |
| `JWT_REFRESH_SECRET`    | Secret used to sign rotating refresh tokens                    | —       |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime (e.g. `15m`)                             | `15m`   |
| `JWT_REFRESH_EXPIRES_IN`| Refresh token lifetime (e.g. `7d`)                             | `7d`    |
| `GOOGLE_CLIENT_ID`      | Google OAuth 2.0 web client ID (for `/auth/google`)            | —       |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (for property image uploads)             | —       |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                                             | —       |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                                          | —       |
| `SSLCOMMERZ_STORE_ID`   | SSLCommerz store id (sandbox or live)                          | —       |
| `SSLCOMMERZ_STORE_PASSWORD` | SSLCommerz store password                                  | —       |
| `SSLCOMMERZ_IS_LIVE`    | Use the live gateway (`true`) or sandbox (`false`)             | `false` |
| `SSLCOMMERZ_SUCCESS_URL`| Browser callback after a successful payment                    | `http://localhost:5000/api/v1/payments/success` |
| `SSLCOMMERZ_FAIL_URL`   | Browser callback after a failed payment                        | `http://localhost:5000/api/v1/payments/fail` |
| `SSLCOMMERZ_CANCEL_URL` | Browser callback after the user cancels                        | `http://localhost:5000/api/v1/payments/cancel` |
| `SSLCOMMERZ_IPN_URL`    | Server-to-server IPN listener for async notifications          | `http://localhost:5000/api/v1/payments/webhook` |
| `SMTP_HOST`             | SMTP host for sending notification emails                      | —       |
| `SMTP_PORT`             | SMTP port                                                      | `587`   |
| `SMTP_USER`             | SMTP username                                                  | —       |
| `SMTP_PASSWORD`         | SMTP password / app password                                   | —       |
| `SMTP_FROM`             | "From" address for outgoing emails                             | —       |
| `REDIS_URL`             | Redis connection URL (e.g. Upstash `rediss://...`) for caching | —       |
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

## Viewing requests, applications & tenancies

Tenants request viewings and apply for rooms; owners review them and create tenancies. Every application status change writes an `audit_log` row and a `notification` to the tenant.

| Method | Path                                | Auth            | Description                                                        |
| ------ | ----------------------------------- | --------------- | ------------------------------------------------------------------ |
| POST   | `/viewing-requests`                 | `TENANT`        | Request a viewing of a room (duplicate pending → 409)              |
| GET    | `/viewing-requests/my-requests`     | `TENANT`        | List own viewing requests (filter `?status=`)                      |
| GET    | `/viewing-requests/received`        | `OWNER`         | List viewings for own properties (filter `?status=`)               |
| PATCH  | `/viewing-requests/:id/status`      | `OWNER` (owner) | `APPROVED` / `REJECTED` / `COMPLETED` / `CANCELLED` (owner can't view) |
| POST   | `/applications`                     | `TENANT`        | Apply for a room (unavailable room or duplicate pending → 409)     |
| GET    | `/applications/my-applications`     | `TENANT`        | List own applications (filter `?status=`)                          |
| PATCH  | `/applications/:id/approve`         | `OWNER` (owner) | Approve — creates an ACTIVE tenancy atomically                     |
| PATCH  | `/applications/:id/reject`          | `OWNER` (owner) | Reject the application                                             |
| GET    | `/tenancies/my-tenancy`             | `TENANT`        | Current ACTIVE tenancy (404 if none)                               |
| GET    | `/tenancies/:propertyId`            | `OWNER` (owner) | Tenancies of own property (403 if not the owner)                   |

Workflow facts:

- Viewing requests: `PENDING → APPROVED/REJECTED/CANCELLED`, `APPROVED → COMPLETED/CANCELLED`; reprocessing a non-pending request is a 409. `received`/`my-requests` support the `status` filter.
- Applications: applying to an already-unavailable room or a second pending application for the same room → 409.
- Approve is **race-safe**: the whole approve (claim the application, mark the room unavailable, auto-reject other pending applications for that room, create the ACTIVE tenancy, audit log + tenant notification) runs in a single interactive `$transaction` with a 30s timeout. Two concurrent approves of the same application yield exactly one 200 and one 409; a room made unavailable between apply and approve fails with 409 and leaves the application PENDING.
- The interactive transaction must run on a real session connection — hence `DATABASE_URL` should be Neon's direct host, not the `-pooler` host.

## Users endpoints

Profile management for the authenticated user. `GET /users/:id` is a public minimal profile used for roommate matching.

| Method | Path                       | Auth       | Description                                              |
| ------ | -------------------------- | ---------- | -------------------------------------------------------- |
| GET    | `/users/me`                | `protect`  | Full authenticated profile incl. `roommatePreference`    |
| PATCH  | `/users/me`                | `protect`  | Update name/phone/avatar/bio and `roommatePreference`    |
| PATCH  | `/users/change-password`   | `protect`  | Change password (`currentPassword` + `newPassword`)      |
| GET    | `/users/:id`               | public     | Public minimal profile of another user                   |

`roommatePreference` fields (all optional): `minBudget`, `maxBudget`, `preferredCity`, `preferredArea`, `genderPreference` (`ANY`/`MALE`/`FEMALE`), `lifestyleTags` (string[]), `isSmoker`, `hasPets`, `moveInDate`.

## Rent payments, bill splits & maintenance

| Method | Path                                              | Auth             | Description                                              |
| ------ | ------------------------------------------------- | ---------------- | -------------------------------------------------------- |
| GET    | `/tenancies/:tenancyId/rent-payments`             | member of tenancy| Rent payment history + upcoming dues                      |
| POST   | `/tenancies/:tenancyId/rent-payments/generate`    | `OWNER` (owner)  | Generate the next rent payment (`dueDate` ISO). One per month — duplicate → 409 |
| POST   | `/rent-payments/:id/mark-paid`                    | `OWNER` (owner)  | Manually mark a rent payment `PAID` (idempotent)         |
| POST   | `/bill-splits`                                    | `OWNER`/`TENANT` | Split a bill across roommates (`ratio` OR `shares`, not both) |
| GET    | `/bill-splits/tenancy/:tenancyId`                 | member of tenancy| Bill splits (+ tenant shares) for a tenancy               |
| PATCH  | `/bill-splits/:id/settle-share`                   | `TENANT`         | Mark the caller's share `PAID`                           |
| POST   | `/maintenance-requests`                           | `TENANT`         | Open a request for the room they rent (active tenancy required) |
| GET    | `/maintenance-requests/my-requests`               | `TENANT`         | Own requests                                             |
| GET    | `/maintenance-requests/property/:propertyId`      | `OWNER` (owner)  | Requests across the owner's property                     |
| PATCH  | `/maintenance-requests/:id/status`                | `OWNER` (owner)  | Update status (validated chain: `OPEN → IN_PROGRESS → RESOLVED → CLOSED`) |
| POST   | `/maintenance-requests/:id/images`                | `TENANT`/`OWNER` | Attach photos (Multer + Cloudinary)                      |

Maintenance status lifecycle: `OPEN → IN_PROGRESS → RESOLVED → CLOSED` (any other transition is rejected with 409). Every status change writes an audit log + in-app notification and emails the tenant. Bill splits and generated rent payments also email the involved tenants.

## Payments (SSLCommerz)

Tenants pay rent and bill splits through SSLCommerz. A `Payment` row records every gateway attempt and is linked to the target `RentPayment` or `BillSplit` so the happy path can flip the target to `PAID` atomically.

### Flow

1. `POST /payments/initiate` with `{ type: "RENT" | "BILL", referenceId }` creates a `Payment` (`status = PENDING`, `gateway = SSLCOMMERZ`, currency `BDT`), links it to the reference, and calls the SSLCommerz session API.
2. The response contains `gatewayPageURL`; the tenant is redirected there and pays on SSLCommerz's hosted page.
3. SSLCommerz redirects the browser to `success_url` / `fail_url` / `cancel_url` (with `tran_id` = the `Payment` id) and also posts an async notification to `ipn_url`.
4. The `success` and `webhook` handlers **never trust the client** — they call SSLCommerz's server-to-server validation API with `val_id`, and only a `VALID` / `VALIDATED` result proceeds.
5. `finalizePaymentAfterVerification` runs in one interactive `$transaction`: claim the `Payment` from `PENDING → SUCCESS`, store `gatewayTransactionId` (`val_id`) + the raw gateway response in `payment.metadata.sslcommerz`, then flip the linked `RentPayment` / `BillSplit` (and the tenant's `BillSplitTenant` share) to `PAID`, and write an audit log + notification.

### Endpoints (`/api/v1/payments`)

| Method | Path          | Auth      | Description                                            |
| ------ | ------------- | --------- | ------------------------------------------------------ |
| POST   | `/initiate`   | `TENANT`  | Create a PENDING payment and get the SSLCommerz checkout URL. Duplicate in-flight payment for the same reference → 409 |
| GET/POST | `/success` | public    | Browser/redirect callback; validates with the gateway and finalizes the payment |
| GET/POST | `/fail`    | public    | Redirect callback; marks the payment `FAILED` and unlinks the reference |
| GET/POST | `/cancel`  | public    | Redirect callback; marks the payment `FAILED` (cancelled) |
| POST   | `/webhook`    | public    | SSLCommerz IPN listener (form post). Re-validates `val_id`, then finalizes/fails |
| GET    | `/my-payments`| `TENANT`  | Paginated payment history (`?page=&limit=`)             |
| GET    | `/:id`        | `protect` | Payment status lookup (payer, related property owner, or admin) |

### Security notes

- `success` requires a valid `val_id` and a successful `VALID` server-side validation before anything is marked paid — a bogus/expired `val_id` yields a 400/502 and the payment stays `PENDING` (or is marked `FAILED` when the gateway reports a failed status).
- `tran_id` is the server-generated `Payment` id, and the gateway's reported amount is compared against the `Payment.amount` to prevent tampering.
- Finalization is idempotent: a repeated success/IPN callback returns the already-`SUCCESS` payment instead of double-flipping the reference.
- Amounts are in BDT; `SSLCOMMERZ_IS_LIVE=false` routes to `https://sandbox.sslcommerz.com`.

## Admin endpoints

Platform-wide operations restricted to `ADMIN` role. All routes require `protect` + `authorize("ADMIN")` (a non-admin gets 403). Mounted at `/api/v1/admin`.

| Method | Path                          | Description                                                                 |
| ------ | ----------------------------- | --------------------------------------------------------------------------- |
| GET    | `/dashboard-stats`            | Aggregate platform counts/sums (uses Prisma `groupBy`/`count`/`aggregate`, never loads full tables) |
| GET    | `/audit-logs`                 | Paginated audit log (filters: `entityType`, `userId`, `from`, `to`)          |
| PATCH  | `/properties/:id/status`      | Deactivate/activate a listing (`{ status: "ACTIVE" \| "INACTIVE" }`); INACTIVE listings disappear from public endpoints |
| GET    | `/payments`                   | All payments paginated (filters: `status`, `gateway`, `purpose`)             |
| GET    | `/users`                      | All users paginated (see users admin)                                       |
| PATCH  | `/users/:id/status`           | Suspend/activate a user (see users admin)                                   |

### Dashboard stats shape

```jsonc
{
  "users":            { "total": 6, "byRole": { "TENANT": 3, "OWNER": 2, "ADMIN": 1 } },
  "properties":       { "total": 3, "active": 3, "inactive": 0 },
  "rooms":            { "total": 6, "available": 5 },
  "tenancies":        { "total": 1, "active": 1 },
  "applications":     { "pending": 1 },
  "viewingRequests":  { "pending": 0 },
  "maintenanceRequests": { "total": 1, "open": 1, "inProgress": 0, "closed": 0 },
  "payments":         { "totalThisMonth": 2, "amountThisMonth": 2200,
                        "successfulThisMonth": 2, "successfulAmountThisMonth": 2200,
                        "totalSuccessful": 2, "totalSuccessfulAmount": 2200 },
  "rentPayments":     { "pending": 1, "overdue": 0 },
  "billSplits":       { "pending": 1 }
}
```

`payments.amountThisMonth`/`successfulAmountThisMonth` are restricted to the current calendar month (UTC); the `*Successful*` values only count `SUCCESS` payments. All queries are server-side aggregations.

### Audit log filters

- `entityType` — exact string match (e.g. `Application`, `MaintenanceRequest`, `RentPayment`, `BillSplit`)
- `userId` — uuid of the actor
- `from` / `to` — ISO datetimes bounding `createdAt`
- `page` / `limit` — pagination (default `1` / `20`, limit max 100)

## Email notifications (SMTP)

Transactional emails are sent alongside selected notification/audit events. Sending is **best-effort**: it runs in a `try/catch` after the DB transaction commits, so an SMTP failure never breaks the main request; results are logged via `[mailer]`.

Events that send an email (to the affected user) when `SMTP_*` vars are configured:

- Application **approved** / **rejected** → to the applicant
- Maintenance request **status changed** → to the tenant
- Payment **succeeded** (rent or bill split) → to the payer
- Rent payment **generated/due** → to the tenant
- Bill split **created** → to each participating tenant

Implementation: `src/lib/mailer.ts` (nodemailer transport + `sendMailToUser`).

## Redis caching

The public `GET /api/v1/properties` listing is cached in Redis (key = canonicalized query params, TTL 60s). Responses include an `X-Cache: HIT | MISS` header. The cache is invalidated (`properties:*`) on any property/room/mutation and when an admin flips a property's active status — so public listings always reflect fresh data.

- All cache operations degrade gracefully: if Redis is unreachable, requests fall back to a direct DB query with no error.
- Implementation: `src/lib/cache.ts` (get/set/invalidate) + wiring in `src/modules/properties/*` and `src/modules/admin/admin.service.ts`.

## API documentation

- **Postman collection** — every endpoint is covered in [`housing-backend.postman_collection.json`](./housing-backend.postman_collection.json) at the repo root. Import it into Postman, set the `baseUrl` collection variable (default `http://localhost:5000/api/v1`), and run **Auth → Login** first — the response script stores the access token in the `token` variable, which the collection's Bearer auth injects into every request. Id variables (`propertyId`, `roomId`, `tenancyId`, ...) are auto-set by their creating requests and reused by the follow-up calls.
- Full interactive API docs (Swagger/OpenAPI) can be generated from the route definitions on request.

Every response uses the standard envelope — success `{ success: true, message, data }`, error `{ success: false, message, errors }` — so client error handling can be uniform.

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