/**
 * Navigation is presentation only; server-issued MFA/tenant authorization is
 * the enforcement boundary. This module never treats URL paths as roles.
 */
export type Workspace='customer'|'merchant'|'admin';
export function workspaceForPath(pathname:string):Workspace{
 if(pathname==='/admin'||pathname.startsWith('/admin/'))return 'admin';
 if(pathname==='/restaurant'||pathname.startsWith('/restaurant/'))return 'merchant';
 return 'customer';
}
export type StaffRestaurant={id:string;name:string;role:string;can_view_orders?:boolean;can_manage_orders?:boolean;can_manage_menu?:boolean};
export function canEnterMerchantPortal(rows:unknown):rows is StaffRestaurant[]{
 return Array.isArray(rows)&&rows.some(row=>row&&typeof row==='object'&&
  typeof row.id==='string'&&/^[0-9a-f-]{36}$/i.test(row.id)&&
  ['owner','manager','staff'].includes(row.role));
}
export function canViewMerchantInbox(row:Pick<StaffRestaurant,'role'|'can_view_orders'>|undefined):boolean{
 return Boolean(row&&(row.role==='owner'||row.role==='manager'||(row.role==='staff'&&row.can_view_orders===true)));
}
