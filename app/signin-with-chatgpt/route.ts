import { googleAuthConfigured, signIn } from '../../lib/google-auth';
export async function GET(request: Request){
 if ((process.env.VERCEL === '1' || process.env.ENT_DEPLOY_TARGET === 'vercel') && googleAuthConfigured()) {
  const value = new URL(request.url).searchParams.get('return_to') ?? '/';
  const redirectTo = value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/signin') && !value.startsWith('/api/auth') ? value : '/';
  return signIn('google', { redirectTo });
 }
 return new Response('Вход через ChatGPT доступен на основном сайте ENT Math. В предварительной версии Vercel авторизация ещё не подключена.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
}
