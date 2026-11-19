/** Restaurant list minimizes customer data; sensitive details require an on-demand request. */
export const MERCHANT_SUMMARY_QUERY = `SELECT id,status,subtotal_kurus,delivery_fee_kurus,total_kurus,
 payment_method,created_at,expires_at,updated_at
 FROM orders WHERE restaurant_id=$1 ORDER BY created_at DESC LIMIT 80`;

/** Readiness is not true when the PostgreSQL connection exists but schema is stale. */
export const REQUIRED_MIGRATIONS = ['001_initial.sql','003_reliability.sql'] as const;
export function hasRequiredMigrations(rows:readonly {filename:string}[]):boolean {
 const applied=new Set(rows.map(row=>row.filename));
 return REQUIRED_MIGRATIONS.every(name=>applied.has(name));
}
