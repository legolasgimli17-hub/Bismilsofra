/** One-shot, opt-in encrypted backup and independent storage verification. */
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {stat,lstat,realpath} from 'node:fs/promises';
import {isAbsolute,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';

const cryptoTool=fileURLToPath(new URL('../../../tools/backup-crypto.mjs',import.meta.url));
export function backupSettings(env){
 const names=['SOFRA_BACKUP_DIR','SOFRA_BACKUP_S3_ENDPOINT','SOFRA_BACKUP_S3_BUCKET','SOFRA_BACKUP_S3_REGION','SOFRA_BACKUP_S3_KEY_ID','SOFRA_BACKUP_S3_SECRET','SOFRA_BACKUP_KEY_B64','PGHOST','PGDATABASE','PGUSER','PGSSLMODE'];
 if(names.some(k=>!env[k]||env[k]!==env[k].trim()))throw Error('Explicit backup configuration required');
 const endpoint=new URL(env.SOFRA_BACKUP_S3_ENDPOINT);
 const key=Buffer.from(env.SOFRA_BACKUP_KEY_B64,'base64');
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash||
    !isAbsolute(env.SOFRA_BACKUP_DIR)||key.length!==32||key.toString('base64')!==env.SOFRA_BACKUP_KEY_B64||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(env.SOFRA_BACKUP_S3_BUCKET)||
    env.PGSSLMODE!=='verify-full'||env.SOFRA_BACKUP_S3_BUCKET===env.S3_BUCKET||
    env.SOFRA_BACKUP_S3_KEY_ID===env.S3_ACCESS_KEY_ID)
  throw Error('Unsafe backup configuration');
 return {directory:env.SOFRA_BACKUP_DIR,endpoint:endpoint.origin,bucket:env.SOFRA_BACKUP_S3_BUCKET,region:env.SOFRA_BACKUP_S3_REGION,
  keyId:env.SOFRA_BACKUP_S3_KEY_ID,secret:env.SOFRA_BACKUP_S3_SECRET};
}
async function digest(stream){
 if(!stream||typeof stream[Symbol.asyncIterator]!=='function')throw Error('Missing backup stream');
 const hash=createHash('sha256');let bytes=0;
 for await(const part of stream){const b=Buffer.from(part);hash.update(b);bytes+=b.length;}
 return {hash:hash.digest('hex'),bytes};
}
function runCrypto(args,env){
 return new Promise((ok,fail)=>{
  const childEnv={SOFRA_BACKUP_KEY_B64:env.SOFRA_BACKUP_KEY_B64};
  for(const name of ['PATH','SystemRoot','WINDIR','HOME','USERPROFILE','TMPDIR','TEMP','TMP','PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGPASSFILE','PGSSLMODE','PGSSLROOTCERT','PGSSLCERT','PGSSLKEY','PGCONNECT_TIMEOUT']){
   if(env[name]!==undefined)childEnv[name]=env[name];
  }
  const child=spawn(process.execPath,[cryptoTool,...args],{env:childEnv,stdio:'ignore',shell:false});
  child.once('error',()=>fail(Error('Backup command could not start')));
  child.once('close',code=>code===0?ok():fail(Error('Backup command failed')));
 });
}
export async function runBackup(env,storage,execute=runCrypto){
 const settings=backupSettings(env);
 const dir=await lstat(settings.directory);
 if(!dir.isDirectory()||dir.isSymbolicLink()||(process.platform!=='win32'&&(dir.mode&0o077)!==0))
  throw Error('Backup directory must be private');
 if(await realpath(settings.directory)!==resolve(settings.directory))throw Error('Backup directory must not traverse symlinks');
 const filename='sofra-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.sofraenc';
 const archive=join(settings.directory,filename);
 const objectKey='database/'+filename;
 await execute(['seal-command',archive,'pg_dump','--format=custom','--no-owner','--no-acl','--no-password'],env);
 await execute(['verify',archive],env);
 const size=(await stat(archive)).size;
 if(size<=36||size>5_000_000_000)throw Error('Backup archive size outside single-upload limit');
 const local=await digest(createReadStream(archive));
 if(local.bytes!==size)throw Error('Backup archive changed');
 await storage.put(objectKey,archive,size);
 const remote=await digest(await storage.get(objectKey));
 if(local.hash!==remote.hash||local.bytes!==remote.bytes)throw Error('Remote backup verification failed');
 // Keep the local encrypted archive even on failure. No automatic deletions.
 return {backup:'offsite-verified',objectKey,bytes:size,sha256:local.hash};
}
function s3Storage(settings){
 const client=new S3Client({endpoint:settings.endpoint,region:settings.region,forcePathStyle:true,
  credentials:{accessKeyId:settings.keyId,secretAccessKey:settings.secret},maxAttempts:2});
 return {async put(key,path,size){
  const body=createReadStream(path);
  try{await client.send(new PutObjectCommand({Bucket:settings.bucket,Key:key,Body:body,ContentLength:size,ContentType:'application/octet-stream'}),{abortSignal:AbortSignal.timeout(600000)});}
  finally{body.destroy();}
 },async get(key){
  const result=await client.send(new GetObjectCommand({Bucket:settings.bucket,Key:key}),{abortSignal:AbortSignal.timeout(600000)});
  return result.Body;
 },close(){client.destroy();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 let storage;
 try{
  storage=s3Storage(backupSettings(process.env));
  console.log(JSON.stringify(await runBackup(process.env,storage)));
 }catch{
  // Provider and subprocess errors can expose credentials, paths or private data.
  console.error('Offsite backup failed; inspect restricted operator diagnostics. Local encrypted archive retained when available.');
  process.exitCode=1;
 }finally{storage?.close();}
}
