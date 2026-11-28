/** AES-256-GCM streaming backup envelope.
 * The key is provided ONLY through a server-side environment variable.
 * Never store it in Git, CLI arguments, logs or a public artifact.
 * File format: 8-byte magic, 12-byte random IV, ciphertext, 16-byte GCM tag.
 */
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {open,link,unlink} from 'node:fs/promises';

const MAGIC=Buffer.from('SOFRABK1','ascii');
const HEADER_BYTES=20;
const TAG_BYTES=16;

function key(){
 const raw=process.env.SOFRA_BACKUP_KEY_B64||'';
 const value=Buffer.from(raw,'base64');
 if(value.length!==32||value.toString('base64')!==raw)
  throw Error('SOFRA_BACKUP_KEY_B64 must be an unlogged 32-byte base64 key.');
 return value;
}
function tempPath(path){return path+'.partial-'+randomBytes(9).toString('hex')}
async function writeAll(file,bytes){
 const buf=Buffer.from(bytes);
 let offset=0;
 while(offset<buf.length){
  const result=await file.write(buf,offset,buf.length-offset,null);
  if(result.bytesWritten<=0)throw Error('Backup output write failed');
  offset+=result.bytesWritten;
 }
}
async function finish(file,tmp,dest){
 await file.sync();
 await file.close();
 // Hard-link is atomic and must FAIL if an output already exists.
 // The temporary name lives next to the destination, on the same filesystem.
 await link(tmp,dest);
 await unlink(tmp);
}
async function seal(input,destination,checkSource=async()=>{}){
 const secret=key();
 const tmp=tempPath(destination);
 let file;
 try{
  file=await open(tmp,'wx',0o600);
  const iv=randomBytes(12);
  const header=Buffer.concat([MAGIC,iv]);
  const cipher=createCipheriv('aes-256-gcm',secret,iv);
  cipher.setAAD(header);
  await writeAll(file,header);
  for await(const part of input)await writeAll(file,cipher.update(part));
  await checkSource();
  await writeAll(file,cipher.final());
  await writeAll(file,cipher.getAuthTag());
  const done=file;file=undefined;
  await finish(done,tmp,destination);
  console.log(JSON.stringify({backup:'sealed',format:'AES-256-GCM',verified:false}));
 }finally{
  if(file)await file.close().catch(()=>{});
  await unlink(tmp).catch(()=>{});
 }
}
async function openEnvelope(inputPath,destination){
 const secret=key();
 const tmp=tempPath(destination);
 const source=await open(inputPath,'r');
 let file;
 try{
  const stat=await source.stat();
  if(stat.size<=HEADER_BYTES+TAG_BYTES)throw Error('Encrypted backup is empty or truncated');
  const header=Buffer.alloc(HEADER_BYTES);
  const tag=Buffer.alloc(TAG_BYTES);
  if((await source.read(header,0,HEADER_BYTES,0)).bytesRead!==HEADER_BYTES||
     (await source.read(tag,0,TAG_BYTES,stat.size-TAG_BYTES)).bytesRead!==TAG_BYTES)
   throw Error('Encrypted backup is truncated');
  if(!header.subarray(0,MAGIC.length).equals(MAGIC))
   throw Error('Unsupported encrypted backup header');
  const iv=header.subarray(MAGIC.length);
  const decipher=createDecipheriv('aes-256-gcm',secret,iv);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  file=await open(tmp,'wx',0o600);
  const cipherStream=source.createReadStream({start:HEADER_BYTES,end:stat.size-TAG_BYTES-1,autoClose:false});
  for await(const part of cipherStream)await writeAll(file,decipher.update(part));
  // Authentication verification happens BEFORE any plaintext becomes final.
  await writeAll(file,decipher.final());
  const done=file;file=undefined;
  await finish(done,tmp,destination);
  console.log(JSON.stringify({backup:'opened',authenticated:true}));
 }finally{
  if(file)await file.close().catch(()=>{});
  await source.close().catch(()=>{});
  await unlink(tmp).catch(()=>{});
 }
}
async function sealCommand(destination,command,args){
 const env={...process.env};
 delete env.SOFRA_BACKUP_KEY_B64;
 const child=spawn(command,args,{shell:false,env,stdio:['ignore','pipe','inherit']});
 // Register both listeners before consuming stdout, including when spawning fails.
 const outcome=new Promise(resolve=>{
  child.once('error',error=>resolve({error}));
  child.once('close',(code,signal)=>resolve({code,signal}));
 });
 try{
  await seal(child.stdout,destination,async()=>{
   const result=await outcome;
   if(result.error)throw result.error;
   if(result.code!==0)throw Error('Backup source failed: '+(result.signal||result.code));
  });
 }finally{
  if(child.exitCode===null&&child.signalCode===null)child.kill();
  await outcome;
 }
}
const [mode,from,to,...args]=process.argv.slice(2);
if(mode==='seal-command'&&from&&to)await sealCommand(from,to,args);
else if(mode==='seal-stdin'&&from&&!to)await seal(process.stdin,from);
else if(mode==='seal'&&from&&to)await seal(createReadStream(from),to);
else if(mode==='open'&&from&&to)await openEnvelope(from,to);
else throw Error('Usage: backup-crypto.mjs seal-command <encrypted-output> <command> [args...] | seal-stdin <encrypted-output> | seal <plain-file> <encrypted-output> | open <encrypted-input> <plain-output>');
