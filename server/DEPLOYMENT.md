# Server Deployment

## Local API

```bash
cd server
npm install
npm run dev
```

Local API URL:

```text
http://localhost:5000/api
```

## Vercel API

Deploy the `server` folder as the Vercel project root. The included `vercel.json` routes every request to `api/index.js`.

Required Vercel environment variables:

```text
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
NODE_ENV=production
ENCRYPTION_KEY=your_encryption_key
CRON_SECRET=your_long_random_cron_secret
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,https://your-client-domain.vercel.app
CLIENT_URL=http://localhost:3000,http://127.0.0.1:3000,https://your-client-domain.vercel.app
```

`CRON_SECRET` guards the cron endpoints. `node-cron` cannot run on serverless, so cron jobs are triggered by Vercel Cron (configured in `vercel.json`) with `Authorization: Bearer <CRON_SECRET>`. Set the same value in Vercel's Cron settings. Endpoints:
- `GET /api/cron/daily-report` — daily operational report (23:59 every day).
- `GET /api/cron/generate-payroll` — auto-generates the previous month's payroll in PENDING_APPROVAL state (00:30 on the 1st). Optional `?month=YYYY-MM` override.

`ENCRYPTION_KEY` is **mandatory in production** — the server refuses to start (throws at load time) without it, so the Vercel function will crash on every request if it is missing. Use the **same value** across every environment that shares a database, or existing encrypted Aadhaar PII will fail to decrypt.

`CORS_ORIGIN` must include the exact deployed frontend origin. If the frontend and API are served from the same Vercel project, include that same `https://your-project.vercel.app` URL too. The server also auto-allows Vercel's `VERCEL_URL` for same-project deployments.

Do not use `CORS_ORIGIN=*` in production. Browser credentials/cookies require a specific allowed origin.

For a hosted Next client, set this in the `client` Vercel project:

```text
NEXT_PUBLIC_API_URL=https://your-server-domain.vercel.app/api
NEXT_PUBLIC_ENABLE_SOCKET=false
```

Socket.IO works for the local long-running server (`npm run dev`). Vercel serverless functions do not keep Socket.IO connections alive, so keep `NEXT_PUBLIC_ENABLE_SOCKET=false` when the API is deployed on Vercel unless you move realtime to a long-running host.

## Secrets & security (one-time)

`server/.env` is gitignored now, but it was committed earlier in git history (commit `cfad6ae`). Treat every credential that ever lived there as exposed:

1. **Rotate** the MongoDB Atlas DB-user password (stop using `demo`) and regenerate the Cloudinary API secret.
2. **Re-issue** `JWT_SECRET` and `ENCRYPTION_KEY` (keep `ENCRYPTION_KEY` constant once data is encrypted with it).
3. **Purge** the old file from history with `git filter-repo --path server/.env --invert-paths` (or BFG) and force-push. This rewrites history — coordinate with anyone who has cloned the repo.
4. Set all of the above (plus `CRON_SECRET`) on the Vercel backend project's environment variables.
