/** Seed a disposable localhost PostgreSQL test DB only. Never run against production. */
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
const raw=process.env.INTEGRATION_DATABASE_URL;
if(!raw)throw Error('INTEGRATION_DATABASE_URL required');
const dsn=new URL(raw);
if(!dsn.pathname.endsWith('_test')||!['localhost','127.0.0.1'].includes(dsn.hostname)){
 throw Error('Refusing seed outside a local disposable _test database.');
}
const pool=new Pool({connectionString:raw,max:1,connectionTimeoutMillis:5000});
try{
 const sql=readFileSync(new URL('../sql/002_development_example.sql',import.meta.url),'utf8');
 await pool.query(sql);
 console.log('Seeded disposable local test database with fictional data.');
}finally{await pool.end()}
