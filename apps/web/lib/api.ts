const BASE=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,'')||'';
export class ApiError extends Error {constructor(public code:string,message:string,public status:number){super(message);this.name='ApiError'}}
export const apiConfigured=()=>Boolean(BASE);
export async function api<T>(path:string,token?:string,init:RequestInit={}):Promise<T>{
 if(!BASE)throw new ApiError('NOT_CONFIGURED','Sunucu henüz yapılandırılmadı.',503);
 const h=new Headers(init.headers);if(init.body)h.set('Content-Type','application/json');if(token)h.set('Authorization',`Bearer ${token}`);
 let res:Response;
 try{res=await fetch(`${BASE}${path}`,{...init,headers:h,cache:'no-store',signal:init.signal??AbortSignal.timeout(15000)})}
 catch{throw new ApiError('NETWORK','İnternet veya sunucu bağlantısı kurulamadı. Sipariş gönderildiyse önce Siparişlerim bölümünden kontrol edin.',503)}
 if(!res.ok){let j:{code?:string;message?:string}={};try{j=await res.json()}catch{}throw new ApiError(j.code||'HTTP_ERROR',j.message||'İşlem tamamlanamadı.',res.status)}
 return res.json() as Promise<T>;
}
