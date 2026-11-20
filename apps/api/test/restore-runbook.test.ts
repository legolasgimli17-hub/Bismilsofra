import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('restore acceptance checks explicit local _test DSNs before any DB write',()=>{
 const script=readFileSync(new URL('../integration/restore-check.ts',import.meta.url),'utf8');
 assert.match(script,/RESTORE_DATABASE_URL/);
 assert.match(script,/INTEGRATION_DATABASE_URL/);
 assert.match(script,/127\.0\.0\.1/);
 assert.match(script,/_test/);
 assert.match(script,/Source and restored database must be separate/);
 assert.doesNotMatch(script,/DROP DATABASE|TRUNCATE|DELETE FROM|pg_dump.*-h/);
});
