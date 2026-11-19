// Explicit connection health is a UI safety aid; server remains source of truth.
export type InboxHealth='connecting'|'connected'|'offline';
export const MAX_INBOX_AGE_MS=20_000;
export function canActOnInbox(state:InboxHealth,lastSuccessMs:number,nowMs:number){return state==='connected'&&Number.isFinite(lastSuccessMs)&&lastSuccessMs>0&&nowMs>=lastSuccessMs&&nowMs-lastSuccessMs<MAX_INBOX_AGE_MS;}
export function inboxLabel(state:InboxHealth,usable:boolean){if(state==='offline')return 'Bağlantı kesildi — siparişler güncellenemiyor';if(state==='connecting'||!usable)return 'Siparişler eşitleniyor';return 'Bağlantı aktif';}
