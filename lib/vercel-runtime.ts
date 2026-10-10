/** Vercel has no Cloudflare bindings. Never emulate persistent storage or
 * trust caller-supplied authentication headers in the portable preview. */
import { createClient } from '@libsql/client/web';
import { TursoD1 } from './turso-d1';
const database = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN
  ? new TursoD1(createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })) : undefined;
export const env = { ...process.env, DB: database as unknown as D1Database | undefined };
