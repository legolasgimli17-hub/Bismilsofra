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

/** Binary image uploads must not be mislabeled as JSON. */
export async function uploadMerchantPhoto<T>(path:string,token:string,file:Blob,rightsConfirmed:boolean):Promise<T>{
 if(!BASE)throw new ApiError('NOT_CONFIGURED','Sunucu henüz yapılandırılmadı.',503);
 if(!rightsConfirmed)throw new ApiError('PHOTO_RIGHTS_REQUIRED','Fotoğraf kullanım iznini onaylayın.',400);
 if(file.size<=0||file.size>5*1024*1024)
  throw new ApiError('PHOTO_SIZE','Fotoğraf boyutu 5 MB sınırını geçemez.',413);
 const headers=new Headers({
  'Authorization':`Bearer ${token}`,
  'Content-Type':'application/octet-stream',
  'X-Photo-Rights-Affirmed':'true'
 });
 let response:Response;
 try{
  response=await fetch(`${BASE}${path}`,{
   method:'POST',headers,body:file,cache:'no-store',signal:AbortSignal.timeout(45000)
  });
 }catch{throw new ApiError('PHOTO_NETWORK','Fotoğraf yükleme bağlantısı kesildi. Tekrar yüklemeden önce menünüzü kontrol edin.',503)}
 if(!response.ok){
  let payload:{code?:string;message?:string}={};
  try{payload=await response.json()}catch{}
  throw new ApiError(payload.code||'PHOTO_UPLOAD_ERROR',payload.message||'Fotoğraf yüklenemedi.',response.status);
 }
 return response.json() as Promise<T>;
}
