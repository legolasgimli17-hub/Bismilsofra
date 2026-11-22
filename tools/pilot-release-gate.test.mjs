import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {assessReleaseEvidence,REQUIRED_GATES} from './pilot-release-gate.mjs';
const manifest=JSON.parse(readFileSync(new URL('../docs/pilot-release-evidence.json',import.meta.url),'utf8'));
test('missing real providers and legal reviews must mean NO_GO',()=>{
 const result=assessReleaseEvidence(manifest);
 assert.equal(result.status,'NO_GO');
 assert.equal(result.required,12);
 assert.equal(result.verified,0);
 assert.equal(result.blockers.length,12);
});
test('one missing, duplicate, unsigned or undocumented gate prevents release',()=>{
 const checked={checks:REQUIRED_GATES.map(id=>({id,status:'verified',
  owner:'Authorized operator',evidence:'docs/evidence-'+id+'.md'}))};
 assert.equal(assessReleaseEvidence(checked).status,'GO');
 assert.equal(assessReleaseEvidence({checks:checked.checks.slice(1)}).status,'NO_GO');
 assert.equal(assessReleaseEvidence({checks:[...checked.checks,checked.checks[0]]}).status,'NO_GO');
 const incomplete=checked.checks.map((x,i)=>i===3?{...x,evidence:''}:x);
 assert.equal(assessReleaseEvidence({checks:incomplete}).status,'NO_GO');
 const blankOwner=checked.checks.map((x,i)=>i===5?{...x,owner:''}:x);
 assert.equal(assessReleaseEvidence({checks:blankOwner}).status,'NO_GO');
});

test('manual production release command must exit nonzero while real gates are open',()=>{
 const path=new URL('./pilot-release-gate.mjs',import.meta.url).pathname;
 const output=spawnSync(process.execPath,[path,'--require-go'],{encoding:'utf8',timeout:5000});
 assert.equal(output.status,2,output.stderr);
 assert.match(output.stdout,/"status":"NO_GO"/);
});
