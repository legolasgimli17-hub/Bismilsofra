import test from 'node:test';
import assert from 'node:assert/strict';
import {DomainError} from '../src/domain.ts';
import {parseMemberPermissions,parseStaffGrant,parseStaffUpdate,parseMemberRemoval,parseAdminAccess} from '../src/access-management.ts';
const invalid=(fn:()=>unknown)=>assert.throws(fn,(e:unknown)=>e instanceof DomainError&&e.statusCode===400);
const staff={role:'staff',canViewOrders:true,canManageOrders:true,canManageMenu:false};
const manager={role:'manager',canViewOrders:true,canManageOrders:true,canManageMenu:true};
test('staff permissions are explicit; no implicit order management',()=>{
 assert.deepEqual(parseMemberPermissions(staff),{
  role:'staff',can_view_orders:true,can_manage_orders:true,can_manage_menu:false
 });
 invalid(()=>parseMemberPermissions({...staff,canManageOrders:true,canViewOrders:false}));
 invalid(()=>parseMemberPermissions({...staff,canManageMenu:'true'}));
 invalid(()=>parseMemberPermissions({...staff,role:'owner'}));
 invalid(()=>parseMemberPermissions({...manager,canManageMenu:false}));
 invalid(()=>parseMemberPermissions(null));
});
test('new staff must be an existing email; managers always full permissions',()=>{
 assert.equal(parseStaffGrant({...manager,email:'  Person@EXAMPLE.com '}).email,'person@example.com');
 invalid(()=>parseStaffGrant({...staff,email:'broken'}));
 invalid(()=>parseStaffGrant({...staff,email:null}));
});
test('changes and removals need exact previous role and flags to prevent stale writes',()=>{
 const expected={role:'staff',canViewOrders:true,canManageOrders:false,canManageMenu:false};
 const parsed=parseStaffUpdate({expected,next:manager});
 assert.equal(parsed.expected.can_view_orders,true);
 assert.equal(parsed.next.role,'manager');
 assert.deepEqual(parseMemberRemoval({expected}),parsed.expected);
 invalid(()=>parseMemberRemoval({expected:{...expected,role:'owner'}}));
 invalid(()=>parseStaffUpdate({expected:{...expected,canManageMenu:null},next:staff}));
});
test('admin access restrictions only accept safe, audit-friendly reason codes',()=>{
 assert.deepEqual(parseAdminAccess({enabled:false,expectedEnabled:true,reasonCode:'abuse'}),
  {enabled:false,expectedEnabled:true,reasonCode:'abuse'});
 invalid(()=>parseAdminAccess({enabled:false,expectedEnabled:false,reasonCode:'abuse'}));
 invalid(()=>parseAdminAccess({enabled:false,expectedEnabled:true,reasonCode:'freeform customer name'}));
 invalid(()=>parseAdminAccess({enabled:'false',expectedEnabled:true,reasonCode:'other'}));
});
