import {Pool} from 'pg';import {expirePending} from './order-service.ts';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL gerekli');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:3});
let running=true;
process.on('SIGINT',()=>{running=false});process.on('SIGTERM',()=>{running=false});
while(running){
 try{const count=await expirePending(pool);if(count)console.log(JSON.stringify({at:new Date().toISOString(),expired:count}))}
 catch(err){console.error('expiry-worker failed',err)}
 await new Promise(resolve=>setTimeout(resolve,5000));
}
await pool.end();
