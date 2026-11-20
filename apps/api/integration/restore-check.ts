/** Disposable PostgreSQL backup/restore acceptance, not a production backup tool.
 * Never connects to any host other than local PostgreSQL *_test databases.
 * No full dataset is printed, copied outside CI or committed to Git.
 */
import assert from 'node:assert/strict';
import {Pool} from 'pg';

function disposable(name:string):string{
 const raw=process.env[name];
 if(!raw)throw Error(name+' must be set explicitly');
 const url=new URL(raw);
 if(!['127.0.0.1','localhost'].includes(url.hostname)||
    !url.pathname.endsWith('_test')||url.pathname.length<7||
    !['postgresql:','postgres:'].includes(url.protocol))
  throw Error('Refusing non-local or non-disposable PostgreSQL database');
 return raw;
}
const sourceDsn=disposable('INTEGRATION_DATABASE_URL');
const restoredDsn=disposable('RESTORE_DATABASE_URL');
if(new URL(sourceDsn).pathname===new URL(restoredDsn).pathname)
 throw Error('Source and restored database must be separate');
const source=new Pool({connectionString:sourceDsn,max:2,connectionTimeoutMillis:5000});
const restore=new Pool({connectionString:restoredDsn,max:2,connectionTimeoutMillis:5000});
const tables=['users','restaurants','restaurant_staff','delivery_zones',
 'restaurant_delivery_zones','products','categories','orders','order_items',
 'order_events','notification_outbox','restaurant_escalations',
 'audit_logs','schema_migrations','worker_heartbeats'] as const;
const sqls={
 migrations:`SELECT count(*)::int AS count,md5(coalesce(string_agg(filename||':'||sha256,'|' ORDER BY filename),'')) AS hash FROM schema_migrations`,
 orders:`SELECT count(*)::int AS count,coalesce(sum(total_kurus),0)::text AS total,
  md5(coalesce(string_agg(id::text||':'||status||':'||total_kurus::text,'|' ORDER BY id),'')) AS hash FROM orders`,
 events:`SELECT count(*)::int AS count,md5(coalesce(string_agg(order_id::text||':'||new_status||':'||created_at::text,'|' ORDER BY id),'')) AS hash FROM order_events`,
 items:`SELECT count(*)::int AS count,md5(coalesce(string_agg(order_id::text||':'||product_name_snapshot||':'||line_total_kurus::text||':'||options_snapshot::text,'|' ORDER BY id),'')) AS hash FROM order_items`,
 snapshots:`SELECT md5(coalesce(string_agg(id::text||':'||address_snapshot::text,'|' ORDER BY id),'')) AS hash FROM orders`,
 addresses:`SELECT count(*)::int AS count,md5(coalesce(string_agg(
   id::text||':'||coalesce(archived_at::text,'active')||':'||zone_id::text||':'||
   md5(full_address||':'||phone),'|' ORDER BY id),'')) AS hash FROM addresses`,
 triggers:`SELECT count(*)::int AS count FROM pg_trigger
  WHERE tgname IN ('order_events_append_only','audit_append_only','order_event_signal')
   AND tgisinternal=false`
};
try{
 for(const table of tables){
  // Table identifiers are fixed within code; no user-provided interpolation.
  const sql='SELECT count(*)::int AS count FROM '+table;
  const [a,b]=await Promise.all([source.query(sql),restore.query(sql)]);
  assert.equal(b.rows[0].count,a.rows[0].count,table+' lost rows during restore');
 }
 for(const [label,sql] of Object.entries(sqls)){
  const [a,b]=await Promise.all([source.query(sql),restore.query(sql)]);
  assert.deepEqual(b.rows[0],a.rows[0],label+' changed during backup/restore');
 }
 const orders=await restore.query('SELECT count(*)::int AS count FROM orders');
 assert.ok(orders.rows[0].count>0,'fixture must contain real order flow before checking restore');
 const migrations=await restore.query("SELECT filename FROM schema_migrations WHERE filename='011_order_events_realtime.sql'");
 assert.equal(migrations.rowCount,1,'latest event-stream migration must survive restore');
 const triggers=await restore.query(sqls.triggers);
 assert.equal(triggers.rows[0].count,3,'append-only audit/event and realtime trigger must be restored');
 const missing=await restore.query(`SELECT count(*)::int AS n FROM orders o
  WHERE NOT EXISTS(SELECT 1 FROM order_events e WHERE e.order_id=o.id)`);
 assert.equal(missing.rows[0].n,0,'every restored order must retain its event history');
 console.log('PASS disposable backup/restore: 15 tables, order snapshots, events, checksums and 3 audit/realtime triggers');
}finally{
 await Promise.all([source.end(),restore.end()]);
}
