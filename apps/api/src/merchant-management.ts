/** Strict operator inputs; never trust restaurant schedule or delivery fees from the browser. */
import {invalid,price} from './domain.ts';

export type WeeklyHour={dayOfWeek:number;openTime:string;closeTime:string};
const WEEK=7*24*60;
const TIME=/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;

const minutes=(time:string):number=>Number(time.slice(0,2))*60+Number(time.slice(3,5));

export function parseWeeklyHours(value:unknown):WeeklyHour[]{
 if(!Array.isArray(value)||value.length>21)
  invalid('HOURS_INVALID','Haftalık çalışma saatleri en fazla 21 aralık içerebilir.');
 const perDay=new Array<number>(7).fill(0);
 const normalized:WeeklyHour[]=[];
 const intervals:Array<{start:number;end:number}>=[];
 for(const slot of value as unknown[]){
  if(!slot||typeof slot!=='object'||Array.isArray(slot))
   invalid('HOURS_INVALID','Çalışma saati geçersiz.');
  const s=slot as Record<string,unknown>;
  if(!Number.isInteger(s.dayOfWeek)||Number(s.dayOfWeek)<0||Number(s.dayOfWeek)>6||
   typeof s.openTime!=='string'||!TIME.test(s.openTime)||
   typeof s.closeTime!=='string'||!TIME.test(s.closeTime))
   invalid('HOURS_INVALID','Gün 0–6; saat HH:MM (24 saat) biçiminde olmalıdır.');
  const day=s.dayOfWeek as number,open=s.openTime as string,close=s.closeTime as string;
  if(open===close)invalid('HOURS_INVALID','Açılış ve kapanış aynı olamaz.');
  if(++perDay[day]>3)invalid('HOURS_INVALID','Bir günde en fazla üç çalışma aralığı olabilir.');
  const start=day*1440+minutes(open);
  const end=start+((minutes(close)-minutes(open)+1440)%1440);
  if(end<=WEEK)intervals.push({start,end});
  else {intervals.push({start,end:WEEK});intervals.push({start:0,end:end-WEEK})}
  normalized.push({dayOfWeek:day,openTime:open,closeTime:close});
 }
 intervals.sort((a,b)=>a.start-b.start||a.end-b.end);
 for(let i=1;i<intervals.length;i++)
  if(intervals[i].start<intervals[i-1].end)
   invalid('HOURS_OVERLAP','Çalışma saatleri çakışıyor; gece yarısını aşan aralıkları da kontrol edin.');
 return normalized.sort((a,b)=>a.dayOfWeek-b.dayOfWeek||a.openTime.localeCompare(b.openTime));
}

export type ZonePolicy={enabled:boolean;minBasketKurus:number;deliveryFeeKurus:number;estimate?:{min:number;max:number}|null};
export function parseZonePolicy(value:unknown):ZonePolicy{
 if(!value||typeof value!=='object'||Array.isArray(value))
  invalid('ZONE_POLICY_INVALID','Teslimat bölgesi ayarları geçersiz.');
 const body=value as Record<string,unknown>;
 if(typeof body.enabled!=='boolean'||!price(body.minBasketKurus)||!price(body.deliveryFeeKurus))
  invalid('ZONE_POLICY_INVALID','Bölge aktifliği boolean; minimum sepet ve teslimat ücreti kuruş cinsinden tam sayı olmalı.');
 const policy:ZonePolicy={enabled:body.enabled as boolean,minBasketKurus:body.minBasketKurus as number,
  deliveryFeeKurus:body.deliveryFeeKurus as number};
 if(body.estimate===undefined)return policy;
 if(body.estimate===null)return {...policy,estimate:null};
 const estimate=body.estimate as {min?:unknown;max?:unknown};
 if(typeof estimate!=='object'||Array.isArray(estimate)||
    typeof estimate.min!=='number'||typeof estimate.max!=='number'||
    !Number.isInteger(estimate.min)||!Number.isInteger(estimate.max)||
    estimate.min<5||estimate.max>180||estimate.max<estimate.min)
  invalid('DELIVERY_ESTIMATE_INVALID','Tahmini teslimat aralığı 5–180 dakika içinde olmalı.');
 return {...policy,estimate:{min:estimate.min,max:estimate.max}};
}
