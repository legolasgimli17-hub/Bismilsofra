import {invalid} from './domain.ts';
export const SUPPORT_STATUSES=['acik','incelemede','cozuldu','kapandi'] as const;
export type SupportStatus=typeof SUPPORT_STATUSES[number];
const moves:Record<SupportStatus,readonly SupportStatus[]>={
 acik:['incelemede','cozuldu'],
 incelemede:['cozuldu'],
 cozuldu:['incelemede','kapandi'],
 kapandi:[]
};
export function isSupportStatus(value:unknown):value is SupportStatus{
 return typeof value==='string'&&(SUPPORT_STATUSES as readonly string[]).includes(value);
}
export function parseSupportUpdate(raw:unknown):{from:SupportStatus;to:SupportStatus}{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))
  invalid('SUPPORT_INVALID','Geçerli destek durum bilgisi gerekli.');
 const body=raw as Record<string,unknown>;
 if(!isSupportStatus(body.expectedStatus)||!isSupportStatus(body.to))
  invalid('SUPPORT_INVALID','Eski ve yeni durum doğru seçilmeli.');
 const from=body.expectedStatus as SupportStatus,to=body.to as SupportStatus;
 if(!moves[from].includes(to))
  invalid('SUPPORT_TRANSITION','Bu destek durumu geçişine izin verilmiyor.',409);
 return {from,to};
}
export function nextSupportStatuses(from:SupportStatus):readonly SupportStatus[]{
 return moves[from];
}
