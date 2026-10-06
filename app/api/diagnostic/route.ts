import { getChatGPTUser } from "@/app/chatgpt-auth";
import { publishedContent, response, failure, trackValue, loadCurrentState } from "@/lib/server-store";
import { diagnosticTasks, sanitizeTask } from "@/lib/engine";
export async function GET(request: Request) { try { const track = trackValue(new URL(request.url).searchParams.get("track") || "profile"), { topics, tasks } = await publishedContent(); const user = await getChatGPTUser(); const state = user ? (await loadCurrentState(user)).state : null; return response({ track, tasks: diagnosticTasks(track, topics, tasks, state?.profile?.learningMode === "school" ? state.profile.grade : undefined, state?.profile?.schoolPathway).map(sanitizeTask) }); } catch(e) { return failure(e); } }
