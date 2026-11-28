import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {backupSettings,runBackup} from '../apps/api/scripts/offsite-backup.mjs';
const cryptoTool=fileURLToPath(new URL('./backup-crypto.mjs',import.meta.url));
function fixture(dir){return {SOFRA_BACKUP_DIR:dir,SOFRA_BACKUP_S3_ENDPOINT:'https://backup.example.test',SOFRA_BACKUP_S3_BUCKET:'private-backups',
 SOFRA_BACKUP_S3_REGION:'auto',SOFRA_BACKUP_S3_KEY_ID:'fixture-key',SOFRA_BACKUP_S3_SECRET:'fixture-secret',SOFRA_BACKUP_KEY_B64:randomBytes(32).toString('base64'),
 PGHOST:'db.example.test',PGDATABASE:'fixture',PGUSER:'backup',PGSSLMODE:'verify-full'};}
async function exec(args,env){
 const actual=args[0]==='seal-command'?['seal-command',args[1],process.execPath,'-e',"process.stdout.write('synthetic dump only')"]:args;
 const r=spawnSync(process.execPath,[cryptoTool,...actual],{env:{...process.env,...env},encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);
}
test('backup settings fail closed without separate HTTPS storage and TLS database',()=>{
 const env=fixture(tmpdir());
 assert.equal(backupSettings(env).bucket,'private-backups');
 for(const bad of [{PGSSLMODE:'disable'},{SOFRA_BACKUP_S3_ENDPOINT:'http://backup.example.test'},{SOFRA_BACKUP_S3_BUCKET:undefined},{S3_BUCKET:'private-backups'},{S3_ACCESS_KEY_ID:'fixture-key'},{SOFRA_BACKUP_KEY_B64:'invalid'}]){
  assert.throws(()=>backupSettings({...env,...bad}));
 }
});
test('job seals, verifies, uploads only ciphertext and checks remote bytes',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'sofra-offsite-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 let stored,key;
 const storage={async put(k,path,size){key=k;stored=await readFile(path);assert.equal(stored.length,size);assert.equal(stored.subarray(0,8).toString(),'SOFRABK1');assert.equal(stored.includes(Buffer.from('synthetic dump only')),false);},
 async get(k){assert.equal(k,key);return Readable.from([stored]);}};
 const report=await runBackup(fixture(dir),storage,exec);
 assert.equal(report.backup,'offsite-verified');
 assert.match(report.sha256,/^[a-f0-9]{64}$/);
 assert.equal((await readdir(dir)).length,1);
 storage.get=async()=>Readable.from([Buffer.from('corrupt')]);
 await assert.rejects(runBackup(fixture(dir),storage,exec),/Remote backup verification failed/);
 assert.equal((await readdir(dir)).length,2,'encrypted archives retained');
});
test('a failed dump never uploads anything',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'sofra-offsite-fail-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 let uploaded=false;
 await assert.rejects(runBackup(fixture(dir),{put(){uploaded=true;}},async()=>{throw Error('dump failed');}),/dump failed/);
 assert.equal(uploaded,false);
 assert.deepEqual(await readdir(dir),[]);
});
