import {test} from 'node:test';import assert from 'node:assert/strict';
// @ts-expect-error Native Node tests.
import {ticketInput,ticketMatches,ticketView,replyTicket,type TicketRow} from '../lib/help-tickets.ts';
const id='5288c040-2200-4c78-9521-8376e5d665a0';
const input={id,category:'material',taskId:'linear-4',message:'Проверка условия',language:'ru'};
const row:TicketRow={id,user_id:'private-owner',category:'material',status:'new',revision:0,created_at:'2026-10-06',updated_at:'2026-10-06',data:JSON.stringify({schema:1,...input,context:{id:'linear-4',version:'hash',prompt:{ru:'2x=8'},material:{answer:'SECRET-KEY',solution:'SECRET-SOLUTION'}},events:[]})};
test('HELP-01: learner view excludes keys, ownership and unrelated history',()=>{
 const view=ticketView(row);assert.ok(!JSON.stringify(view).includes('SECRET'));assert.ok(!JSON.stringify(view).includes('private-owner'));assert.equal(view.context?.version,'hash');assert.ok(JSON.stringify(ticketView(row,true)).includes('SECRET-KEY'));
});
test('HELP-01: input is bounded and retry identity includes message/category/material/language',()=>{
 assert.ok(ticketMatches(row,ticketInput(input)));assert.ok(!ticketMatches(row,ticketInput({...input,message:'Иной текст'})));
 assert.equal(ticketInput({...input,category:'account'}).taskId,'');
 for(const bad of [{message:''},{message:'x'.repeat(2001)},{id:'wrong'},{category:'admin'},{language:'en'},{taskId:''}])assert.throws(()=>ticketInput({...input,...bad}));
});
test('HELP-01: replies are append-only and retries do not duplicate; stale editor cannot overwrite',()=>{
 const reply={eventId:id,message:'Условие проверено.',status:'answered',revision:0};const result=replyTicket(row,reply,'2026-10-06');
 assert.equal(result.data.events.length,1);const next={...row,data:JSON.stringify(result.data),revision:1,status:'answered' as const};
 assert.equal(replyTicket(next,reply).replayed,true);assert.throws(()=>replyTicket(next,{...reply,message:'Подмена'}),/TICKET_CONFLICT/);assert.throws(()=>replyTicket(next,{...reply,eventId:crypto.randomUUID()}),/TICKET_CONFLICT/);
 assert.equal(replyTicket(next,{...reply,eventId:crypto.randomUUID(),revision:1,status:'working'}).data.events.length,2);
});
