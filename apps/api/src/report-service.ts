/** Pilot metrics: aggregated counts only, no customer/address/phone/order IDs.
 * Revenue here is restaurant-reported delivered order value, NOT proof of
 * cash/POS collection, and never the platform's own earnings.
 */
import type {Pool} from 'pg';
import {invalid} from './domain.ts';

export type ReportDays=7|30;
export function parseReportDays(value:unknown):ReportDays{
 if(value===undefined||value==='7')return 7;
 if(value==='30')return 30;
 return invalid('REPORT_PERIOD_INVALID','Rapor aralığı 7 veya 30 gün olmalı.');
}
const SCOPE=`o.created_at >= (((now() AT TIME ZONE 'Europe/Istanbul')::date -
 ($1::int - 1))::timestamp AT TIME ZONE 'Europe/Istanbul')
 AND ($2::uuid IS NULL OR o.restaurant_id=$2::uuid)`;

export const PILOT_SUMMARY_SQL=`SELECT
 COUNT(*)::int AS orders,
 COUNT(*) FILTER (WHERE o.status='beklemede')::int AS pending,
 COUNT(*) FILTER (WHERE o.accepted_at IS NOT NULL)::int AS accepted,
 COUNT(*) FILTER (WHERE o.status='teslim_edildi')::int AS delivered,
 COUNT(*) FILTER (WHERE o.status='suresi_doldu')::int AS expired,
 COUNT(*) FILTER (WHERE o.status='reddedildi')::int AS rejected,
 COUNT(*) FILTER (WHERE o.status IN ('musteri_iptal','restoran_iptal'))::int AS cancelled,
 COUNT(*) FILTER (WHERE o.status='teslim_edilemedi')::int AS delivery_failed,
 COUNT(*) FILTER (WHERE o.status IN ('kabul_edildi','hazirlaniyor','hazir','yolda'))::int AS in_progress,
 COALESCE(SUM(o.total_kurus) FILTER (WHERE o.status='teslim_edildi'),0)::bigint AS delivered_total_kurus,
 COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (o.accepted_at-o.created_at)))
  FILTER (WHERE o.accepted_at IS NOT NULL))::int,0) AS avg_accept_seconds
 FROM orders o WHERE ${SCOPE}`;

export const PILOT_DAILY_SQL=`WITH days AS (
 SELECT ((now() AT TIME ZONE 'Europe/Istanbul')::date - g.n) AS day
 FROM generate_series(0,$1::int-1) g(n)
), activity AS (
 SELECT (o.created_at AT TIME ZONE 'Europe/Istanbul')::date AS day,
 COUNT(*)::int AS orders,
 COUNT(*) FILTER (WHERE o.status='teslim_edildi')::int AS delivered,
 COUNT(*) FILTER (WHERE o.status='suresi_doldu')::int AS expired,
 COALESCE(SUM(o.total_kurus) FILTER (WHERE o.status='teslim_edildi'),0)::bigint AS delivered_total_kurus
 FROM orders o WHERE ${SCOPE}
 GROUP BY (o.created_at AT TIME ZONE 'Europe/Istanbul')::date
)
 SELECT TO_CHAR(days.day::timestamp,'YYYY-MM-DD') AS day,
 COALESCE(activity.orders,0)::int AS orders,
 COALESCE(activity.delivered,0)::int AS delivered,
 COALESCE(activity.expired,0)::int AS expired,
 COALESCE(activity.delivered_total_kurus,0)::bigint AS delivered_total_kurus
 FROM days LEFT JOIN activity ON activity.day=days.day
 ORDER BY days.day`;

export const PILOT_REPEAT_SQL=`SELECT COUNT(*)::int AS repeat_customers
 FROM (
  SELECT o.customer_id FROM orders o
  WHERE ${SCOPE}
  GROUP BY o.customer_id HAVING COUNT(*)>=2
 ) repeated`;

export const PILOT_RESTAURANTS_SQL=`SELECT r.id,r.name,r.active,
 COUNT(o.id)::int AS orders,
 COUNT(o.id) FILTER (WHERE o.status='teslim_edildi')::int AS delivered,
 COUNT(o.id) FILTER (WHERE o.status='suresi_doldu')::int AS expired,
 COUNT(o.id) FILTER (WHERE o.status IN ('musteri_iptal','restoran_iptal'))::int AS cancelled,
 COALESCE(SUM(o.total_kurus) FILTER (WHERE o.status='teslim_edildi'),0)::bigint AS delivered_total_kurus
 FROM restaurants r
 LEFT JOIN orders o ON o.restaurant_id=r.id
  AND o.created_at >= (((now() AT TIME ZONE 'Europe/Istanbul')::date -
    ($1::int - 1))::timestamp AT TIME ZONE 'Europe/Istanbul')
 WHERE r.active=true OR EXISTS(
  SELECT 1 FROM orders historical WHERE historical.restaurant_id=r.id
   AND historical.created_at >= (((now() AT TIME ZONE 'Europe/Istanbul')::date -
    ($1::int - 1))::timestamp AT TIME ZONE 'Europe/Istanbul')
 )
 GROUP BY r.id ORDER BY orders DESC,r.name LIMIT 50`;

/** Return only aggregates. All data stays scoped to the merchant by DB query. */
export async function readPilotReport(pool:Pool,days:ReportDays,restaurantId:string|null){
 const [summary,daily,repeat]=await Promise.all([
  pool.query(PILOT_SUMMARY_SQL,[days,restaurantId]),
  pool.query(PILOT_DAILY_SQL,[days,restaurantId]),
  pool.query(PILOT_REPEAT_SQL,[days,restaurantId])
 ]);
 return {periodDays:days,scope:restaurantId===null?'platform':'restaurant',
  summary:{...summary.rows[0],repeat_customers:repeat.rows[0].repeat_customers},
  daily:daily.rows};
}
export async function readPilotAdminReport(pool:Pool,days:ReportDays){
 const [metrics,restaurants]=await Promise.all([
  readPilotReport(pool,days,null),pool.query(PILOT_RESTAURANTS_SQL,[days])
 ]);
 return {...metrics,restaurants:restaurants.rows};
}
export async function readPilotMerchantReport(pool:Pool,days:ReportDays,restaurantId:string,actorId:string){
 const right=await pool.query(`SELECT role FROM restaurant_staff
  WHERE user_id=$1 AND restaurant_id=$2`,[actorId,restaurantId]);
 if(!right.rowCount||!['owner','manager'].includes(right.rows[0].role))
  invalid('ROLE_FORBIDDEN','Finansal sipariş raporunu yalnızca restoran sahibi ve yöneticisi görebilir.',403);
 return readPilotReport(pool,days,restaurantId);
}
