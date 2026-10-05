import { getChatGPTUser } from "@/app/chatgpt-auth";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { learnerStates } from "@/db/schema";
import { configuration, response, failure, ApiError } from "@/lib/server-store";

export async function GET() {
  try {
    if (!configuration().DB) throw new ApiError("Рейтинг доступен после подключения хранилища.", 503);
    const user = await getChatGPTUser();
    const rows = await getDb().select({ id: learnerStates.userId, name: sql<string>`json_extract(${learnerStates.data}, '$.profile.name')`, xp: sql<number>`json_extract(${learnerStates.data}, '$.xp')`, progress: sql<string>`json_extract(${learnerStates.data}, '$.progress')` }).from(learnerStates).where(sql`json_extract(${learnerStates.data}, '$.preferences.leaderboard') = 1 AND json_extract(${learnerStates.data}, '$.profile.name') IS NOT NULL`);
    const ranked = rows.map(r => { const progress = JSON.parse(r.progress || "{}"); return { id: r.id, name: r.name, xp: Number(r.xp || 0), mastered: Object.values(progress).filter(p => p && typeof p === "object" && (p as { mastered?: unknown }).mastered === true).length }; }).sort((a, b) => b.mastered - a.mastered || b.xp - a.xp || a.name.localeCompare(b.name));
    const entries = ranked.slice(0, 50).map((r, index) => ({ rank: index + 1, name: r.name, xp: r.xp, mastered: r.mastered, level: Math.floor(r.xp / 250) + 1, self: r.id === user?.userId, testIdentity: r.id === "local_seedy" }));
    const ownIndex = ranked.findIndex(r => r.id === user?.userId);
    return response({ entries, optedIn: ownIndex >= 0, totalOptedIn: ranked.length, currentUserRank: ownIndex >= 0 ? ownIndex + 1 : null, ranking: "confirmed-mastery-then-xp", note: { ru: "Участие добровольное. Показывается выбранное имя, подтверждённое освоение и игровой опыт; адреса и идентификаторы аккаунтов скрыты. Сначала сравниваются освоенные темы, затем XP.", kk: "Қатысу ерікті. Таңдаған атың, расталған меңгеру және ойын тәжірибесі көрсетіледі; аккаунт адресі мен идентификаторы жасырылған. Алдымен меңгерілген тақырып, кейін XP салыстырылады." } });
  } catch(e) { return failure(e); }
}
