export const ticketCategories=['material','service','account'] as const;
export const ticketStatuses=['new','working','answered','closed'] as const;
export type TicketCategory=typeof ticketCategories[number];
export type TicketStatus=typeof ticketStatuses[number];
export type TicketData={schema:1;message:string;taskId:string;language:'ru'|'kk';context?:{id:string;version:string;prompt:unknown;material:unknown};events:{id:string;message:string;status:TicketStatus;at:string}[]};
export type TicketRow={id:string;user_id:string;category:TicketCategory;status:TicketStatus;data:string;revision:number;created_at:string;updated_at:string};
export function ticketInput(input:Record<string,unknown>){
 if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.id)||!ticketCategories.includes(input.category as TicketCategory)||typeof input.message!=='string'||input.message.trim().length<3||input.message.length>2000||input.language!=='ru'&&input.language!=='kk'||input.taskId!==undefined&&(typeof input.taskId!=='string'||input.taskId.length>120))throw Error('INVALID_TICKET');
 const taskId=typeof input.taskId==='string'?input.taskId:'';if(input.category==='material'&&!taskId)throw Error('MATERIAL_REQUIRED');
 return {id:input.id,category:input.category as TicketCategory,message:input.message.trim(),language:input.language as 'ru'|'kk',taskId:input.category==='material'?taskId:''};
}
export function ticketMatches(row:TicketRow,input:ReturnType<typeof ticketInput>){const d=JSON.parse(row.data) as TicketData;return row.category===input.category&&d.message===input.message&&d.taskId===input.taskId&&d.language===input.language;}
export function ticketView(row:TicketRow,admin=false){
 const d=JSON.parse(row.data) as TicketData;
 return {id:row.id,category:row.category,status:row.status,message:d.message,taskId:d.taskId,language:d.language,revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at,events:d.events,context:d.context?{id:d.context.id,version:d.context.version,prompt:d.context.prompt,...(admin?{material:d.context.material}:{})}:null};
}
export function replyTicket(row:TicketRow,input:Record<string,unknown>,now=new Date().toISOString()){
 if(typeof input.eventId!=='string'||!/^[a-f0-9-]{36}$/i.test(input.eventId)||!ticketStatuses.includes(input.status as TicketStatus)||typeof input.message!=='string'||input.message.trim().length<3||input.message.length>4000||!Number.isInteger(input.revision))throw Error('INVALID_REPLY');
 const data=JSON.parse(row.data) as TicketData,prior=data.events.find(e=>e.id===input.eventId),message=input.message.trim();
 if(prior){if(prior.message!==message||prior.status!==input.status)throw Error('TICKET_CONFLICT');return {replayed:true,data};}
 if(row.revision!==input.revision)throw Error('TICKET_CONFLICT');if(data.events.length>=100)throw Error('TICKET_CAPACITY');
 data.events.push({id:input.eventId,message,status:input.status as TicketStatus,at:now});return {replayed:false,data};
}
