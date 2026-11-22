import type {Order} from './types.ts';
/** Select only a completed, customer-owned order from the authenticated API response.
 * Do not allow a pending delivery to be accidentally ordered a second time.
 */
export function latestCompletedOrder(orders:readonly Order[]):Order|null{
 let latest:Order|null=null;
 let latestTimestamp=-1;
 for(const order of orders){
  if(order.status!=='teslim_edildi'||typeof order.id!=='string'||!order.id||typeof order.restaurant_id!=='string'||!order.restaurant_id)continue;
  const timestamp=Date.parse(order.created_at);
  if(!Number.isFinite(timestamp))continue;
  if(timestamp>latestTimestamp){latest=order;latestTimestamp=timestamp}
 }
 return latest;
}
