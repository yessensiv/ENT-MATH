import { signOut } from '../../lib/google-auth';
export async function GET() {
  if (process.env.VERCEL === '1' || process.env.ENT_DEPLOY_TARGET === 'vercel') return signOut({ redirectTo: '/' });
  return new Response('Sign out is managed by the Sites gateway.', { status: 503 });
}
