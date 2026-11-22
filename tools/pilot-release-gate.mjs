/** Human-reviewed release evidence must stay NO_GO until every external gate passes.
 * A green build is not proof of successful actual customer delivery.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const REQUIRED_GATES=[
 'isolated_https_staging','real_oidc_mfa_accounts','dual_independent_alerts',
 'encrypted_offsite_backup_restore','authenticated_multi_replica_load',
 'mobile_accessibility_devices','licensed_food_media','security_independent_review',
 'real_restaurant_consent','customer_support_staffed','kvkk_etbis_legal_approval',
 'ops_incident_oncall'
];
export function assessReleaseEvidence(payload){
 const checks=Array.isArray(payload?.checks)?payload.checks:[];
 const blockers=[];
 for(const id of REQUIRED_GATES){
  const matches=checks.filter(c=>c&&c.id===id);
  if(matches.length!==1){blockers.push({id,why:matches.length?'duplicate':'missing'});continue}
  const item=matches[0];
  if(item.status!=='verified'||typeof item.owner!=='string'||item.owner.trim().length<2||
    typeof item.evidence!=='string'||item.evidence.trim().length<8)
   blockers.push({id,why:'not independently verified with owner and evidence'});
 }
 return {status:blockers.length?'NO_GO':'GO',required:REQUIRED_GATES.length,
  verified:REQUIRED_GATES.length-blockers.length,blockers};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const source=process.env.PILOT_RELEASE_EVIDENCE_FILE||new URL('../docs/pilot-release-evidence.json',import.meta.url);
 const result=assessReleaseEvidence(JSON.parse(readFileSync(source,'utf8')));
 console.log(JSON.stringify(result));
 if(process.argv.includes('--require-go')&&result.status!=='GO')process.exitCode=2;
}
