import { adminAuthenticate, adminData, response, failure, parseBody, updateContent } from "@/lib/server-store";
export async function GET() { try { await adminAuthenticate(); return response(await adminData()); } catch(e) { return failure(e); } }
export async function POST(request: Request) { try { const user = await adminAuthenticate(); return response(await updateContent(user, await parseBody(request))); } catch(e) { return failure(e); } }
