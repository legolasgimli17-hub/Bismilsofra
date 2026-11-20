import test from 'node:test';
import assert from 'node:assert/strict';
import {DomainError} from '../src/domain.ts';
import {parseReportDays,PILOT_SUMMARY_SQL,PILOT_DAILY_SQL,PILOT_REPEAT_SQL,PILOT_RESTAURANTS_SQL} from '../src/report-service.ts';
test('7 and 30 day report periods have bounded server validation',()=>{
 assert.equal(parseReportDays(undefined),7);assert.equal(parseReportDays('7'),7);
 assert.equal(parseReportDays('30'),30);
 for(const x of ['0','100','7;DROP TABLE',30,NaN,{},null]){
  assert.throws(()=>parseReportDays(x),(e:unknown)=>e instanceof DomainError&&e.statusCode===400);
 }
});
test('all order statistics operate on Istanbul-local day and scoped merchant filter',()=>{
 for(const sql of [PILOT_SUMMARY_SQL,PILOT_DAILY_SQL,PILOT_REPEAT_SQL]){
  assert.match(sql,/Europe\/Istanbul/);
  assert.match(sql,/\$2::uuid IS NULL OR o\.restaurant_id=\$2::uuid/);
  assert.match(sql,/\$1::int/);
 }
 assert.match(PILOT_DAILY_SQL,/generate_series/);
 assert.match(PILOT_RESTAURANTS_SQL,/LIMIT 50/);
});
test('report aggregates never select or return order/customer PII fields',()=>{
 for(const sql of [PILOT_SUMMARY_SQL,PILOT_DAILY_SQL,PILOT_RESTAURANTS_SQL]){
  assert.doesNotMatch(sql,/address_snapshot|phone|full_address|directions|verified_email|oidc_subject|customer_id/i);
 }
 assert.match(PILOT_REPEAT_SQL,/GROUP BY o\.customer_id/);
 assert.doesNotMatch(PILOT_REPEAT_SQL,/SELECT.*verified_email/i);
});
test('delivery total is only reported on delivered orders, not total placed or platform fees',()=>{
 assert.match(PILOT_SUMMARY_SQL,/SUM\(o\.total_kurus\) FILTER \(WHERE o\.status='teslim_edildi'\)/);
 assert.doesNotMatch(PILOT_SUMMARY_SQL,/commission|platform_fee|paid_by_customer/i);
});
