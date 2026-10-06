/** Idempotent request identity. Kept separate from mutable server help flags. */
export function submissionPayload(input:Record<string,unknown>) {
 if(input.action==='diagnostic')return JSON.stringify(['diagnostic',input.track,input.answers]);
 return JSON.stringify([input.action==='review'?'attempt':input.action,input.taskId,input.answer,input.steps||'',Boolean(input.assisted),input.reviewId||'']);
}
export async function submissionIdentity(input:Record<string,unknown>) {
 if(input.submissionId!==undefined){if(typeof input.submissionId!=='string'||!/^[a-zA-Z0-9_-]{8,120}$/.test(input.submissionId))throw Error('INVALID_SUBMISSION_ID');return input.submissionId;}
 // Compatibility for old/offline clients. Exact replays are still idempotent.
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(submissionPayload(input)+':'+String(input.draftUpdatedAt??'legacy')));
 return 'legacy-'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
