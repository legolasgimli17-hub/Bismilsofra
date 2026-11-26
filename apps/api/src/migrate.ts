/** Checksum-verified, transactional migration runner. Never uses demo seed 002. */
import {Pool} from 'pg';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL gerekli');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000});
const migrations=['001_initial.sql','003_reliability.sql','004_escalation.sql','005_product_revisions.sql','006_restaurant_media.sql','007_product_options_editor.sql','008_outbox_leases.sql','009_escalation_leases.sql','010_worker_heartbeats.sql','011_order_events_realtime.sql','012_admin_menu_imports.sql','013_addresses_archived.sql','014_customer_order_quotas.sql','015_neighborhood_delivery_estimates.sql','016_order_delivery_estimates.sql'];
const src=(name:string)=>readFileSync(fileURLToPath(new URL('../sql/'+name,import.meta.url)),'utf8');
const checksum=(text:string)=>createHash('sha256').update(text).digest('hex');
const withoutWrapper=(sql:string)=>sql.replace(/^\s*BEGIN;\s*/i,'').replace(/\s*COMMIT;\s*$/i,'');
const client=await pool.connect();
try{
 await client.query('SELECT pg_advisory_lock($1)',[50991260]);
 await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,sha256 char(64) NOT NULL,applied_at timestamptz NOT NULL DEFAULT now()
 )`);
 const tracked=await client.query('SELECT filename,sha256 FROM schema_migrations');
 const existing=new Map(tracked.rows.map(r=>[r.filename,r.sha256]));
 const hasOld=await client.query("SELECT to_regclass('public.order_events') AS t");
 if(hasOld.rows[0].t&&!existing.has('001_initial.sql')){
  if(process.env.BASELINE_V05!=='YES')throw new Error('Eski v0.5 DB tespit edildi. Önce şema ve yedekleri doğrulayın; bilinçli yükseltme için BASELINE_V05=YES kullanın.');
  const check=await client.query("SELECT to_regclass('public.notification_outbox') AS outbox,to_regclass('public.restaurants') AS restaurants");
  if(!check.rows[0].outbox||!check.rows[0].restaurants)throw new Error('v0.5 şeması eksik. Otomatik temel alınamaz.');
  await client.query('INSERT INTO schema_migrations(filename,sha256) VALUES($1,$2)', ['001_initial.sql',checksum(src('001_initial.sql'))]);
  existing.set('001_initial.sql',checksum(src('001_initial.sql')));
  console.log('001_initial.sql mevcut v0.5 şeması olarak işaretlendi (BASELINE_V05=YES).');
 }
 for(const filename of migrations){
  const sql=src(filename),sum=checksum(sql);
  if(existing.has(filename)){
   if(existing.get(filename)!==sum)throw new Error(filename+' daha önce uygulandı fakat dosyanın içeriği değiştirilmiş. Migration durduruldu.');
   console.log('SKIP',filename);continue;
  }
  await client.query('BEGIN');
  try{await client.query(withoutWrapper(sql));
   await client.query('INSERT INTO schema_migrations(filename,sha256) VALUES($1,$2)',[filename,sum]);
   await client.query('COMMIT');console.log('APPLIED',filename);
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}
 }
}finally{
 await client.query('SELECT pg_advisory_unlock($1)',[50991260]).catch(()=>{});
 client.release();await pool.end();
}
