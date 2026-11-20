/** Restaurant list minimizes customer data; sensitive details require an on-demand request. */
export const MERCHANT_SUMMARY_QUERY = `SELECT id,status,subtotal_kurus,delivery_fee_kurus,total_kurus,
 payment_method,created_at,expires_at,updated_at
 FROM orders WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT 80`;

/** Readiness is not true when the PostgreSQL connection exists but schema is stale. */
export const REQUIRED_MIGRATIONS = ['001_initial.sql','003_reliability.sql','004_escalation.sql','005_product_revisions.sql','006_restaurant_media.sql','007_product_options_editor.sql','008_outbox_leases.sql'] as const;
export function hasRequiredMigrations(rows:readonly {filename:string}[]):boolean {
 const applied=new Set(rows.map(row=>row.filename));
 return REQUIRED_MIGRATIONS.every(name=>applied.has(name));
}

/**
 * Public discovery must use the same business-hours/closure constraints as
 * placeOrder. An OPEN toggle alone is not a promise that checkout will work.
 * Alias `r` refers to restaurants in every query using this fragment.
 * The final transaction STILL rechecks eligibility (race-safe checkout).
 */
export const CURRENTLY_ACCEPTING_SQL = `
 r.active = true AND r.is_open = true AND r.is_busy = false AND r.accepts_orders = true
 AND EXISTS (
  SELECT 1 FROM restaurant_delivery_zones dz
  JOIN delivery_zones z ON z.id=dz.zone_id
  WHERE dz.restaurant_id=r.id AND dz.enabled=true AND z.enabled=true
 )
 AND EXISTS (
  SELECT 1 FROM restaurant_hours h
  WHERE h.restaurant_id=r.id AND (
   (h.open_time<h.close_time
    AND h.day_of_week=EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul'))
    AND (now() AT TIME ZONE 'Europe/Istanbul')::time >= h.open_time
    AND (now() AT TIME ZONE 'Europe/Istanbul')::time < h.close_time)
   OR
   (h.open_time>h.close_time AND (
    (h.day_of_week=EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul'))
     AND (now() AT TIME ZONE 'Europe/Istanbul')::time >= h.open_time)
    OR
    (h.day_of_week=(EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Istanbul'))::int+6)%7
     AND (now() AT TIME ZONE 'Europe/Istanbul')::time < h.close_time)
   ))
  )
 )
 AND NOT EXISTS (
  SELECT 1 FROM restaurant_closures c
  WHERE c.restaurant_id=r.id AND c.starts_at<=now() AND c.ends_at>now()
 )`;
