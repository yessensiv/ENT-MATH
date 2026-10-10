# Vercel database and Google authentication

Turso database `database-cobalt-cloud` is connected to the Vercel project `ent-math`. All existing SQLite migrations were applied to an empty target. The original Cloudflare database is unchanged.

Google Cloud project: `infra-throne-511213-g8` (ENT Math). Web client: ENT Math Vercel. Callback: `https://ent-math.vercel.app/api/auth/callback/google`.

Server settings: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `AUTH_URL`. OAuth secrets are stored as Vercel secrets. Never add `.sites-runtime/google-oauth.json` or `.env.local` to Git.

Auth.js checks Google's verified email and uses the stable Google subject as the learner ID. It does not trust Sites authentication headers on Vercel. Google identities remain separate from ChatGPT identities: the existing history has not been silently assigned by email to a different account.

Local adapter test: `node --experimental-transform-types --test tests/turso-d1.test.mjs`. Production build: `npm run build:vercel`.

Database schema/import tool: `node --env-file=.env.local --experimental-transform-types scripts/provision-turso.mjs [backup.json]`. It refuses any nonempty target, validates the backup checksum/schema/counts, and rolls back failed imports. For rollback keep the original Cloudflare deployment and independently verified archive. Never rerun schema provisioning against the live database.

The archive from 2026-10-06 was restored successfully into `.sites-runtime/backups/google-migration-rehearsal-2026-10-10.sqlite` with integrity `ok`. A current export and explicit identity linking are required before migration of old history. This archive is not presented as a current production export.

Pending acceptance: actual Google login, profile write/reload, cross-device revision conflicts, logout, and final Google audience status. AI credentials have not been copied to Vercel in this change.
