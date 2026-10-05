import { publishedContent, response, failure, trackValue } from "@/lib/server-store";
import { diagnosticTasks, sanitizeTask } from "@/lib/engine";
export async function GET(request: Request) { try { const track = trackValue(new URL(request.url).searchParams.get("track") || "profile"), { topics, tasks } = await publishedContent(); return response({ track, tasks: diagnosticTasks(track, topics, tasks).map(sanitizeTask) }); } catch(e) { return failure(e); } }
