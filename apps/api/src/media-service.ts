/**
 * Bismil Sofra restaurant-owned photo pipeline.
 * Never trust filename, declared MIME, SVG, user metadata or arbitrary URLs.
 * Normalize an uploaded JPEG/PNG/WebP to metadata-free WebP before S3 storage.
 */
import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
import {S3Client,PutObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {DomainError,invalid} from './domain.ts';

const MAX_UPLOAD=5*1024*1024;
export const MAX_PHOTO_UPLOAD_BYTES=MAX_UPLOAD;
export const MAX_PHOTO_OUTPUT_BYTES=3*1024*1024;
export type PhotoSettings={endpoint:string;bucket:string;region:string;keyId:string;secret:string;publicOrigin:string;host:string};
export type PreparedPhoto={bytes:Buffer;width:number;height:number;sourceFormat:string};

export function imageSignature(bytes:Buffer):'jpeg'|'png'|'webp'|null{
 if(bytes.length<16)return null;
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'jpeg';
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp';
 return null;
}

export async function prepareRestaurantPhoto(input:Buffer):Promise<PreparedPhoto>{
 if(!Buffer.isBuffer(input)||!input.length||input.length>MAX_UPLOAD)
  return invalid('PHOTO_SIZE','Fotoğraf 5 MB sınırını geçemez.',413);
 const format=imageSignature(input);
 if(!format)return invalid('PHOTO_TYPE','Yalnızca JPEG, PNG ve WebP fotoğraflar kabul edilir.',415);
 try{
  const source=sharp(input,{limitInputPixels:20_000_000,failOn:'error',animated:false});
  const meta=await source.metadata();
  if(!meta.width||!meta.height||meta.width<80||meta.height<80||
   meta.width*meta.height>20_000_000||!['jpeg','png','webp'].includes(meta.format)||
   (meta.pages??1)>1)
   return invalid('PHOTO_INVALID','Bu görsel boyutu veya biçimi desteklenmiyor.',400);
  // JPEG EXIF orientation is applied; EXIF location/device metadata is discarded.
  const out=await source.rotate().resize({width:1600,height:1200,fit:'inside',withoutEnlargement:true})
   .webp({quality:80,effort:4}).toBuffer({resolveWithObject:true});
  if(!out.info.width||!out.info.height||out.data.length>MAX_PHOTO_OUTPUT_BYTES)
   return invalid('PHOTO_SIZE','Fotoğraf optimize edilemedi.',413);
  return {bytes:out.data,width:out.info.width,height:out.info.height,sourceFormat:format};
 }catch(error){
  if(error instanceof DomainError)throw error;
  return invalid('PHOTO_INVALID','Fotoğraf okunamadı veya bozuk.',400);
 }
}

export function photoStorageSettings(env:NodeJS.ProcessEnv=process.env):PhotoSettings|null{
 const names=['S3_ENDPOINT','S3_BUCKET','S3_REGION','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY','MEDIA_PUBLIC_ORIGIN','PUBLIC_IMAGE_CDN_HOST'] as const;
 const values=names.map(name=>env[name]?.trim());
 if(values.some(x=>!x))return null;
 const [endpoint,bucket,region,keyId,secret,publicOrigin,host]=values as string[];
 try{
  const e=new URL(endpoint),p=new URL(publicOrigin);
  const localTest=env.NODE_ENV==='test'&&e.protocol==='http:'&&['127.0.0.1','localhost'].includes(e.hostname);
  if((e.protocol!=='https:'&&!localTest)||p.protocol!=='https:'||
   e.username||e.password||e.pathname!=='/'||e.search||e.hash||
   p.pathname!=='/'||p.search||p.hash||p.username||p.password||
   p.hostname.toLowerCase()!==host.toLowerCase()||
   !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,62}$/.test(bucket)||
   !/^[a-z0-9-]{2,30}$/.test(region)||keyId.length<3||secret.length<8)
   return null;
  return {endpoint:e.origin,bucket,region,keyId,secret,publicOrigin:p.origin,host};
 }catch{return null}
}
function s3(settings:PhotoSettings){
 return new S3Client({endpoint:settings.endpoint,region:settings.region,forcePathStyle:true,
  credentials:{accessKeyId:settings.keyId,secretAccessKey:settings.secret},maxAttempts:2});
}
export type MediaStorage={
 put:(key:string,bytes:Buffer)=>Promise<void>;
 remove:(key:string)=>Promise<void>;
};
export function s3MediaStorage(settings:PhotoSettings):MediaStorage{
 const client=s3(settings);
 return {
  async put(key,bytes){await client.send(new PutObjectCommand({
   Bucket:settings.bucket,Key:key,Body:bytes,ContentType:'image/webp',
   CacheControl:'public, max-age=31536000, immutable'
  }))},
  async remove(key){await client.send(new DeleteObjectCommand({Bucket:settings.bucket,Key:key}))}
 };
}
export function photoObjectKey(restaurantId:string):string{
 return 'restaurants/'+restaurantId+'/photos/'+randomUUID()+'.webp';
}
export function photoPublicUrl(settings:PhotoSettings,key:string):string{
 if(!/^restaurants\/[a-f0-9-]{36}\/photos\/[a-f0-9-]{36}\.webp$/.test(key))
  throw new Error('Unsafe media object key');
 return settings.publicOrigin+'/'+key;
}
