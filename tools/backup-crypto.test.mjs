import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,stat,access,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const tool=fileURLToPath(new URL('./backup-crypto.mjs',import.meta.url));
const key=randomBytes(32).toString('base64');
function call(mode,...args){
 return spawnSync(process.execPath,[tool,mode,...args],{
  env:{...process.env,SOFRA_BACKUP_KEY_B64:key},
  encoding:'utf8',timeout:15000
 });
}
test('encrypted backup round trip: no plaintext in encrypted file, owner-only permissions',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'sofra-backup-'));
 t.after(async()=>await rm(dir,{recursive:true,force:true}));
 const src=join(dir,'fixture.bin'),encrypted=join(dir,'encrypted.sofra'),plain=join(dir,'restored.bin');
 const source=randomBytes(180000);
 await writeFile(src,source);
 const seal=call('seal',src,encrypted);
 assert.equal(seal.status,0,seal.stderr);
 const wrapped=await readFile(encrypted);
 assert.equal(wrapped.subarray(0,8).toString(),'SOFRABK1');
 assert.equal(wrapped.includes(source.subarray(0,80)),false);
 const permissions=(await stat(encrypted)).mode&0o777;
 assert.equal(permissions,0o600,'encrypted backups must be readable by owner only');
 const restore=call('open',encrypted,plain);
 assert.equal(restore.status,0,restore.stderr);
 assert.deepEqual(await readFile(plain),source);
 assert.equal((await stat(plain)).mode&0o777,0o600);
 // No output is overwritten if the destination already exists.
 assert.notEqual(call('seal',src,encrypted).status,0);
});
test('tampered ciphertext or authentication tag cannot publish plaintext',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'sofra-tamper-'));
 t.after(async()=>await rm(dir,{recursive:true,force:true}));
 const src=join(dir,'source'),sealed=join(dir,'sealed'),tampered=join(dir,'tampered');
 await writeFile(src,randomBytes(99999));
 assert.equal(call('seal',src,sealed).status,0);
 const bytes=await readFile(sealed);
 bytes[bytes.length-1]^=0xff;
 await writeFile(tampered,bytes);
 const output=join(dir,'unauthenticated-plain');
 assert.notEqual(call('open',tampered,output).status,0);
 await assert.rejects(access(output));
 assert.equal((await readdir(dir)).some(name=>name.startsWith('unauthenticated-plain.partial')),false);
});
test('bad key or truncated backup fails closed',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'sofra-invalid-'));
 t.after(async()=>await rm(dir,{recursive:true,force:true}));
 const tiny=join(dir,'tiny'),out=join(dir,'plain');
 await writeFile(tiny,Buffer.from('bad'));
 const badKey=spawnSync(process.execPath,[tool,'open',tiny,out],{
  env:{...process.env,SOFRA_BACKUP_KEY_B64:'short'},encoding:'utf8',timeout:15000
 });
 assert.notEqual(badKey.status,0);
 assert.notEqual(call('open',tiny,out).status,0);
 await assert.rejects(access(out));
});

test('a failed dump never publishes an encrypted partial backup',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'sofra-incomplete-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const output=join(dir,'archive.sofraenc');
 const failure=call('seal-command',output,process.execPath,'-e',"process.stdout.write('partial dump');process.exitCode=9");
 assert.notEqual(failure.status,0);
 assert.deepEqual(await readdir(dir),[]);
 const missing=call('seal-command',output,join(dir,'missing-executable'));
 assert.notEqual(missing.status,0);
 assert.deepEqual(await readdir(dir),[]);
 const success=call('seal-command',output,process.execPath,'-e',"if(process.env.SOFRA_BACKUP_KEY_B64)process.exit(2);process.stdout.write('complete dump')");
 assert.equal(success.status,0,success.stderr);
 const restored=join(dir,'restored');
 assert.equal(call('open',output,restored).status,0);
 assert.equal(await readFile(restored,'utf8'),'complete dump');
});
