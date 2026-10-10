// Reads owner-created OAuth credentials locally; never writes them to logs or Git.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const file = process.argv[2];
if (!file) throw Error('Pass the local Google OAuth JSON path.');
const oauth = JSON.parse(readFileSync(file, 'utf8')).web;
if (!oauth?.client_id?.endsWith('.apps.googleusercontent.com') || !oauth.client_secret) throw Error('Invalid web OAuth client');
const values = { AUTH_GOOGLE_ID: oauth.client_id, AUTH_GOOGLE_SECRET: oauth.client_secret, AUTH_SECRET: randomBytes(32).toString('base64url'), AUTH_URL: 'https://ent-math.vercel.app' };
const cli = process.argv[3] ?? 'node_modules/vercel/dist/index.js';
for (const environment of ['production', 'preview']) for (const [name, value] of Object.entries(values)) {
 const run = spawnSync(process.execPath, [cli, 'env', 'add', name, environment, '--scope', 'iv-8f66', '--yes', '--sensitive'], { input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
 if (run.status !== 0) throw Error(`Could not configure ${name} for ${environment}. Check Vercel settings; values remain hidden.`);
 console.log(`${environment}: ${name} configured`);
}
