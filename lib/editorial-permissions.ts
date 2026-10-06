export const editorialRoles=['author','math','methodology','kazakh','publisher'] as const;
export type EditorialRole=typeof editorialRoles[number];
/** Only server configuration grants roles. Malformed configuration grants none. */
export function editorialPermissions(email:string,admin:boolean,configured?:string){
 let roles:EditorialRole[]=[];
 if(admin)roles=[...editorialRoles];
 else try{const value=JSON.parse(configured||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))for(const [address,assigned]of Object.entries(value))if(address.trim().toLowerCase()===email.trim().toLowerCase()&&Array.isArray(assigned))roles=assigned.filter((r):r is EditorialRole=>editorialRoles.includes(r as EditorialRole));}catch{/* Fail closed. */}
 return{access:roles.length>0,author:roles.includes('author'),publish:roles.includes('publisher'),reviews:roles.filter(r=>r==='math'||r==='methodology'||r==='kazakh')};
}
