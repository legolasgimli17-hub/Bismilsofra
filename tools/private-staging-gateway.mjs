import http from 'node:http';
import {pathToFileURL} from 'node:url';

const hopByHop=['connection','keep-alive','proxy-authenticate','proxy-authorization',
 'te','trailer','transfer-encoding','upgrade'];

function forwardingHeaders(source){
 const headers={...source};
 for(const name of String(headers.connection??'').split(','))delete headers[name.trim().toLowerCase()];
 for(const name of hopByHop)delete headers[name];
 return headers;
}

export function createPrivateStagingGateway({webPort=3000,apiPort=4188}={}){
 for(const port of [webPort,apiPort]){
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid loopback upstream port');
 }
 return http.createServer((req,res)=>{
  const target=req.url??'/';
  if(!target.startsWith('/')||target.startsWith('//')||target.includes('\\')){
   res.writeHead(400);res.end();return;
  }
  const pathname=target.split('?',1)[0];
  const api=pathname==='/v1'||pathname.startsWith('/v1/')||pathname==='/healthz'||pathname==='/readyz';
  const port=api?apiPort:webPort;
  const headers=forwardingHeaders(req.headers);
  // The trusted upstream addresses are fixed. Never trust client-provided proxy metadata.
  for(const name of Object.keys(headers)){
   if(name==='forwarded'||name.startsWith('x-forwarded-'))delete headers[name];
  }
  headers.host='127.0.0.1:'+port;
  const upstream=http.request({hostname:'127.0.0.1',port,path:target,
   method:req.method,headers},response=>{
   res.writeHead(response.statusCode??502,forwardingHeaders(response.headers));
   response.on('error',()=>res.destroy());
   response.pipe(res);
  });
  upstream.setTimeout(30000,()=>upstream.destroy());
  upstream.on('error',()=>{
   if(res.headersSent){res.destroy();return}
   res.writeHead(502,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify({code:'STAGING_UPSTREAM_UNAVAILABLE',message:'Test servisine ulaşılamıyor.'}));
  });
  req.on('error',()=>upstream.destroy());
  res.on('close',()=>upstream.destroy());
  req.pipe(upstream);
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=4170;
 createPrivateStagingGateway().listen(port,'127.0.0.1',()=>{
  console.log('Bismil Sofra staging gateway: http://127.0.0.1:'+port);
 });
}
