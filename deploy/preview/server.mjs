import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';

const root=resolve('customer-app/frontend/dist');
const expiry=Date.parse(process.env.DONEEO_PREVIEW_EXPIRES_AT);
if(!Number.isFinite(expiry))throw new Error('The preview requires an absolute expiry.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=http.createServer(async(request,response)=>{
  const json=(status,value)=>{response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value));};
  try{
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    if(request.url==='/healthz'){
      const checks=await Promise.all(['http://127.0.0.1:8080/api/health','http://127.0.0.1:5174/api/architecture'].map(async url=>(await fetch(url,{signal:AbortSignal.timeout(3000)})).status));
      const healthy=checks.every(status=>status===200);
      return json(healthy?200:503,{status:healthy?'ok':'starting',services:{customer:checks[0],planner:checks[1]}});
    }
    if(Date.now()>=expiry){
      if(request.url?.startsWith('/api/'))return json(410,{error:'This test preview has ended.'});
      response.writeHead(410,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      return response.end('<!doctype html><title>Doneeo preview ended</title><h1>This Doneeo test preview has ended.</h1>');
    }
    if(request.url==='/__preview')return json(200,{application:'Doneeo',environment:'test-preview',commit:process.env.RAILWAY_GIT_COMMIT_SHA||process.env.DONEEO_GIT_COMMIT||'local',expiresAt:new Date(expiry).toISOString()});
    if(request.url?.startsWith('/api/')){
      const parts=[];let size=0;
      for await(const part of request){size+=part.length;if(size>512*1024)return json(413,{error:'Request too large.'});parts.push(part);}
      const body=Buffer.concat(parts);
      const headers={...request.headers,'x-forwarded-proto':process.env.DONEEO_COOKIE_SECURE==='false'?'http':'https','x-forwarded-host':request.headers.host,'content-length':String(body.length)};
      delete headers['transfer-encoding'];delete headers.connection;
      const upstream=http.request({hostname:'127.0.0.1',port:8080,path:request.url,method:request.method,headers},result=>{
        response.writeHead(result.statusCode||502,result.headers);result.pipe(response);
      });
      upstream.setTimeout(180000,()=>upstream.destroy());
      upstream.on('error',()=>{if(!response.headersSent)json(502,{error:'The preview service is starting. Please try again shortly.'});else response.destroy();});
      response.on('close',()=>upstream.destroy());upstream.end(body);return;
    }
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);return response.end();}
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(pathname.split('/').some(part=>part.startsWith('.'))){response.writeHead(404);return response.end();}
    let file=resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+sep)){response.writeHead(403);return response.end();}
    let info;try{info=await stat(file);}catch{}
    if(!info?.isFile()){
      if(extname(pathname)){response.writeHead(404);return response.end();}
      file=resolve(root,'index.html');info=await stat(file);
    }
    response.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
    response.setHeader('Content-Length',info.size);
    response.setHeader('Cache-Control',pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-store');
    if(request.method==='HEAD')return response.end();
    createReadStream(file).on('error',()=>response.destroy()).pipe(response);
  }catch{if(!response.headersSent)json(503,{error:'The preview is starting. Please try again shortly.'});else response.destroy();}
});
server.headersTimeout=15000;
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Public Doneeo preview is listening.'));
const stop=()=>{server.close();setTimeout(()=>process.exit(0),1000).unref();};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
// A successful exit makes the ON_FAILURE policy stop this test instance.
setTimeout(stop,Math.max(1,expiry-Date.now()));
