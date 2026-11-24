import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceForPath,canEnterMerchantPortal,canViewMerchantInbox} from './workspace-access.ts';
import {selectedMerchantId} from './merchant-selection.ts';
const idA='11111111-1111-4111-8111-111111111111',idB='22222222-2222-4222-8222-222222222222';
test('merchant, admin and customer routes never share a workspace shell',()=>{
 assert.equal(workspaceForPath('/'),'customer');
 assert.equal(workspaceForPath('/checkout'),'customer');
 assert.equal(workspaceForPath('/panel'),'customer');
 assert.equal(workspaceForPath('/restaurant'),'merchant');
 assert.equal(workspaceForPath('/restaurant/overview'),'merchant');
 assert.equal(workspaceForPath('/restaurant/manage'),'merchant');
 assert.equal(workspaceForPath('/restaurants/abc'),'customer');
 assert.equal(workspaceForPath('/admin'),'admin');
 assert.equal(workspaceForPath('/admin/overview'),'admin');
 assert.equal(workspaceForPath('/administer'),'customer');
});
test('empty or invalid restaurant roles cannot unlock merchant portal',()=>{
 assert.equal(canEnterMerchantPortal([]),false);
 assert.equal(canEnterMerchantPortal([{id:idA,role:'viewer'}]),false);
 assert.equal(canEnterMerchantPortal([{id:'fake',role:'owner'}]),false);
 assert.equal(canEnterMerchantPortal([{id:idA,role:'staff'}]),true);
 assert.equal(canEnterMerchantPortal([{id:idA,role:'owner'}]),true);
});
test('selected branch is always among server-authorized restaurant IDs',()=>{
 const restaurants=[{id:idA},{id:idB}];
 assert.equal(selectedMerchantId(restaurants,idB),idB);
 assert.equal(selectedMerchantId(restaurants,'33333333-3333-4333-8333-333333333333'),idA);
 assert.equal(selectedMerchantId(restaurants,''),idA);
 assert.equal(selectedMerchantId([],'unknown'),'');
});
test('menu-only staff do not get the order inbox, while assigned viewers and managers do',()=>{
 assert.equal(canViewMerchantInbox(undefined),false);
 assert.equal(canViewMerchantInbox({role:'staff',can_view_orders:false}),false);
 assert.equal(canViewMerchantInbox({role:'staff',can_view_orders:true}),true);
 assert.equal(canViewMerchantInbox({role:'manager',can_view_orders:false}),true);
 assert.equal(canViewMerchantInbox({role:'viewer',can_view_orders:true}),false);
});
