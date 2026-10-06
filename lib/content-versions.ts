export type OverrideVersionRow={status:string;data:string;history:string};
/** Read the last published snapshot, including legacy rows created before
 * publication and draft editing were separated. Never mutate old snapshots. */
export function publishedSnapshot(row:OverrideVersionRow):Record<string,unknown>|null {
 const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
 if(row.status==='published')return object(JSON.parse(row.data));
 const history=JSON.parse(row.history) as {status?:string;previousStatus?:string;previousData?:unknown}[];
 if(!Array.isArray(history))return null;
 for(let i=history.length-1;i>=0;i--){const item=history[i];if((item.previousStatus??history[i-1]?.status)==='published'){const data=object(item.previousData);if(data)return data;}}
 return null;
}
