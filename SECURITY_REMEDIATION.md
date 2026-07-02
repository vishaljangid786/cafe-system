# Security Remediation — Manual Steps (C1)

Most audit findings were fixed in code (see the audit summary). Two things **cannot be
done from code** and require your action. Do these before the next production deploy.

## 1. Rotate every secret that was ever committed to git history

`server/.env` was committed in an earlier commit (`cfad6ae`) and is still reachable in
history even though it's no longer tracked. Anyone with the repo can read it, forge JWTs
for any user (incl. super_admin), and access the DB/Cloudinary.

**Rotate all of these now (in their respective consoles):**

- **`MONGO_URI`** — change the MongoDB Atlas DB user's password.
- **`JWT_SECRET`** — set a new value. (This logs everyone out — expected. Generate one:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)
- **`CLOUDINARY_API_SECRET`** — regenerate the Cloudinary API key/secret.
- Do **NOT** change `ENCRYPTION_KEY` — it must stay constant or encrypted Aadhaar data
  won't decrypt.

Update the new values in your Vercel project env vars (server) and redeploy.

## 2. Purge the secrets from git history

Removing the file from HEAD is not enough — the blob is still in old commits.

```bash
# from the repo root, with a clean working tree
pip install git-filter-repo   # or: brew install git-filter-repo
git filter-repo --path server/.env --path super-admin.json --path server/server_dev.log --invert-paths
git push --force --all
git push --force --tags
```

> `--force` rewrites history. Coordinate with anyone else who has a clone (they must
> re-clone). If this repo has ever been public, assume the secrets are compromised and
> the rotation in step 1 is mandatory regardless.

## 3. Housekeeping

- Run `cd server && npm install` to sync `package-lock.json` after `bcryptjs` was removed
  from `package.json`.
- Confirm the demo accounts (`*@cafeos.com`, password `password123`) do **not** exist in
  the production database. The startup auto-seed is now gated to non-production, and the
  `/login` "Quick Login" panel is stripped from production builds — but any demo accounts
  already seeded into prod should be deleted or have their passwords changed.

## Note: new opt-in billing setting

`billing.autoSettleOnComplete` (default **true**, preserving current behavior) was added.
Set it to `false` per branch only if you run tabs/credit and do **not** want completing an
order to auto-mark it paid (which would otherwise book uncollected cash into the drawer).
