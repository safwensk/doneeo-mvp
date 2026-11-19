import { Miniflare } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=process.cwd();
const config=JSON.parse(await readFile(resolve(root,'dist/server/wrangler.json'),'utf8'));
const bindings={};
for(const key of ['GEMINI_API_KEY','GEMINI_MODEL','GEMINI_THINKING_LEVEL','XAI_API_KEY','XAI_MODEL','OPENAI_API_KEY','ANTHROPIC_API_KEY','CLAUDE_MODEL','GOOGLE_MAPS_API_KEY','GOOglemap_API_KEY']) {
  if(process.env[key]) bindings[key]=process.env[key];
}
const serverRoot=resolve(root,'dist/server');
const modules=[{type:'ESModule',path:resolve(serverRoot,'index.js')},
  ...(await readdir(serverRoot,{recursive:true})).filter(path=>/\.m?js$/.test(path)&&path!=='index.js')
    .map(path=>({type:'ESModule',path:resolve(serverRoot,path)}))];
const runtime=new Miniflare({
  modules,
  compatibilityDate:config.compatibility_date,
  compatibilityFlags:config.compatibility_flags,
  host:'127.0.0.1',port:5174,
  d1Databases:{DB:'00000000-0000-4000-8000-000000000000'},
  d1Persist:resolve(process.env.DONEEO_PLANNER_STATE||'.wrangler/state','v3/d1'),
  assets:{directory:resolve(root,'dist/client'),binding:'ASSETS'},
  bindings,
});
await runtime.ready;
await (await runtime.getD1Database('DB')).prepare('SELECT count(*) FROM work_cases').first();
console.log('Canonical planner ready on private port 5174.');
let stopping=false;
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{
  if(stopping)return;stopping=true;
  await runtime.dispose();process.exit(0);
});
