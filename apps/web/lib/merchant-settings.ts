/** Turkish lira input helpers. Money is only trusted after server-side integer-kurus validation. */
export function kurusToInput(value:number):string{
 if(!Number.isSafeInteger(value)||value<0)return '';
 return (value/100).toFixed(2).replace('.',',');
}
export function inputToKurus(raw:string):number|null{
 const input=raw.trim();
 if(!/^(?:0|[1-9][0-9]{0,6})(?:[,.][0-9]{1,2})?$/.test(input))return null;
 const [whole,fraction='']=input.replace(',','.').split('.');
 const result=Number(whole)*100+Number((fraction+'00').slice(0,2));
 return Number.isSafeInteger(result)&&result<=100_000_000?result:null;
}
export type MerchantScheduleSlot={dayOfWeek:number;openTime:string;closeTime:string};
export const WEEKDAY_NAMES=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'] as const;
export function newTimeSlot(dayOfWeek:number):MerchantScheduleSlot{
 return {dayOfWeek,openTime:'09:00',closeTime:'22:00'};
}
