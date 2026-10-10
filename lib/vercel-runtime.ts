/** Vercel has no Cloudflare bindings. Never emulate persistent storage or
 * trust caller-supplied authentication headers in the portable preview. */
export const env = process.env;
