/** Worker process watchdog. This is not physical device/provider delivery proof. */
import type {Pool} from 'pg';
export const WORKER_NAMES=['outbox','escalation','expiry'] as const;
export type WorkerName=typeof WORKER_NAMES[number];
export type WorkerStatus='running'|'delivery_error'|'error'|'stale'|'missing';
export const MAX_WORKER_AGE_MS=35_000;
type CycleState='ok'|'delivery_error'|'error';
export type WorkerRow={
 worker_name:string;last_seen_at:Date|string;last_cycle_state:CycleState;
 last_successful_cycle_at:Date|string|null;last_work_at:Date|string|null;last_failure_at:Date|string|null
};
export type WorkerHealth={
 name:WorkerName;status:WorkerStatus;lastSeenAt:string|null;
 lastSuccessfulCycleAt:string|null;lastWorkAt:string|null;lastFailureAt:string|null
};
export async function recordWorkerCycle(
 pool:Pool,name:WorkerName,outcome:{success:boolean;work?:number;failed?:number}
):Promise<void>{
 if(!(WORKER_NAMES as readonly string[]).includes(name))throw Error('unknown worker');
 const work=outcome.work??0,failed=outcome.failed??0;
 if(!Number.isSafeInteger(work)||work<0||work>1000||
    !Number.isSafeInteger(failed)||failed<0||failed>1000)
  throw Error('invalid worker counters');
 const state:CycleState=!outcome.success?'error':failed>0?'delivery_error':'ok';
 await pool.query(`INSERT INTO worker_heartbeats
  (worker_name,last_seen_at,last_cycle_state,last_successful_cycle_at,last_work_at,last_failure_at)
  VALUES($1,now(),$2,
   CASE WHEN $2::text<>'error' THEN now() ELSE NULL END,
   CASE WHEN $3::int>0 THEN now() ELSE NULL END,
   CASE WHEN $2::text<>'ok' THEN now() ELSE NULL END)
  ON CONFLICT(worker_name) DO UPDATE SET
   last_seen_at=EXCLUDED.last_seen_at,
   last_cycle_state=EXCLUDED.last_cycle_state,
   last_successful_cycle_at=COALESCE(EXCLUDED.last_successful_cycle_at,worker_heartbeats.last_successful_cycle_at),
   last_work_at=COALESCE(EXCLUDED.last_work_at,worker_heartbeats.last_work_at),
   last_failure_at=COALESCE(EXCLUDED.last_failure_at,worker_heartbeats.last_failure_at)`,
  [name,state,work]);
}
function iso(value:Date|string|null|undefined):string|null{
 if(value==null)return null;
 const d=value instanceof Date?value:new Date(value);
 return Number.isFinite(d.getTime())?d.toISOString():null;
}
export function summarizeWorkerHealth(rows:readonly WorkerRow[],nowMs=Date.now()):WorkerHealth[]{
 const found=new Map(rows.map(row=>[row.worker_name,row]));
 return WORKER_NAMES.map(name=>{
  const row=found.get(name),seen=iso(row?.last_seen_at);
  const age=seen?nowMs-Date.parse(seen):Infinity;
  const status:WorkerStatus=!row||!seen?'missing':
   !Number.isFinite(age)||age< -10_000||age>MAX_WORKER_AGE_MS?'stale':
   row.last_cycle_state==='error'?'error':
   row.last_cycle_state==='delivery_error'?'delivery_error':'running';
  return {name,status,lastSeenAt:seen,
   lastSuccessfulCycleAt:iso(row?.last_successful_cycle_at),
   lastWorkAt:iso(row?.last_work_at),lastFailureAt:iso(row?.last_failure_at)};
 });
}
export async function readWorkerHealth(pool:Pool):Promise<WorkerHealth[]>{
 const result=await pool.query(`SELECT worker_name,last_seen_at,last_cycle_state,
  last_successful_cycle_at,last_work_at,last_failure_at FROM worker_heartbeats`);
 return summarizeWorkerHealth(result.rows as WorkerRow[]);
}
