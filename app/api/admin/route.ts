import { editorAuthenticate, isAdmin, adminData, editableContent, response, failure, parseBody, updateContent, ApiError } from "@/lib/server-store";
import { EXAM_RULES } from "@/lib/engine";
export async function GET(request: Request) {
  try {
    const user=await editorAuthenticate(); const params = new URL(request.url).searchParams, kind = params.get("kind"), id = params.get("id");
    if (!kind) return response(await adminData(isAdmin(user)));
    if (kind === "rules") return response({ material: EXAM_RULES, status: "published", readOnly: true });
    if (kind !== "task" && kind !== "topic") throw new ApiError("Неизвестный тип материала.");
    if (!id) throw new ApiError("Укажите материал.", 404); return response(await editableContent(kind, id));
  } catch(e) { return failure(e); }
}
export async function POST(request: Request) { try { const user = await editorAuthenticate(); return response(await updateContent(user, await parseBody(request))); } catch(e) { return failure(e); } }
