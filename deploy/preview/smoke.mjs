import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const base=process.env.DONEEO_SMOKE_URL||'http://127.0.0.1:3000';
const fixturePath=process.env.DONEEO_SMOKE_STATE||'/tmp/doneeo-preview-smoke.json';
const cookies=new Map();let csrf;
async function call(path,body){
  const headers={Cookie:[...cookies].map(([key,value])=>`${key}=${value}`).join(';')};
  if(body!==undefined){headers['Content-Type']='application/json';if(csrf)headers[csrf.csrfHeader]=csrf.csrfToken;}
  const response=await fetch(base+path,{headers,method:body===undefined?'GET':'POST',body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(160000)});
  for(const cookie of response.headers.getSetCookie()){
    const pair=cookie.split(';')[0];const at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));
  }
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{}
  return {status:response.status,data,text};
}
const deadline=Date.now()+120000;
let lastHealth='No response';
while(true){
  try{const health=await fetch(base+'/healthz',{signal:AbortSignal.timeout(3000)});lastHealth=await health.text();if(health.ok)break;}catch{}
  if(Date.now()>deadline)throw new Error('Preview did not become healthy: '+lastHealth);
  await sleep(1000);
}
assert.equal((await call('/')).status,200);
assert.equal((await call('/.env.local')).status,404);
assert.equal((await call('/%2e%2e%2f.env.local')).status,404);
assert.equal((await call('/api/workspace/latest')).status,401);
csrf=(await call('/api/auth/session')).data;
if(process.argv[2]==='resume'){
  const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
  assert.equal((await call('/api/auth/login',fixture.account)).status,200);
  csrf=(await call('/api/auth/session')).data;
  const latest=(await call('/api/workspace/latest')).data;
  assert.equal(latest.workCaseId,fixture.workCaseId);
  assert.deepEqual(latest.discussion,fixture.discussion);
  const resumed=await call('/api/plan',{workCaseId:fixture.workCaseId,resume:true,operationId:randomUUID()});
  assert.equal(resumed.status,200);
  assert.equal(resumed.data.workCaseId,fixture.workCaseId);
  assert.ok(resumed.data.analysis.tasks.length);
  console.log('PASS: login, saved conversation and canonical work survive replacing the container.');
}else{
  const account={name:'Preview check',email:`preview-${randomUUID()}@example.test`,password:randomUUID()+randomUUID()};
  const withoutCsrf=csrf;csrf=undefined;
  assert.equal((await call('/api/auth/register',account)).status,403);
  csrf=withoutCsrf;
  assert.equal((await call('/api/auth/register',account)).status,200);
  csrf=(await call('/api/auth/session')).data;
  const plan=await call('/api/plan',{request:'Assemble one flat-pack desk and organize the boxes in the same ground-floor room. All parts and instructions are supplied; scheduling is flexible.',operationId:randomUUID(),correlationId:randomUUID()});
  assert.equal(plan.status,200);
  assert.ok(plan.data.workCaseId&&plan.data.analysis.tasks.length&&plan.data.discussion.length>=2);
  await writeFile(fixturePath,JSON.stringify({account,workCaseId:plan.data.workCaseId,discussion:plan.data.discussion}),{mode:0o600});
  console.log('PASS: public page, private-file guards, authentication/CSRF and native planning.');
}
