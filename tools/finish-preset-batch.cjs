const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),work=path.join(root,'artifacts/preset-batch');
let jobs=JSON.parse(fs.readFileSync(path.join(work,'jobs.json')));
const native='D:/AE2023/Adobe After Effects 2023/Support Files/AfterFX.com';
const log=path.join(work,'finisher.txt');
function note(s){fs.appendFileSync(log,new Date().toISOString()+' '+s+'\n');console.log(s);}
function rows(){return fs.readFileSync(path.join(work,'results.jsonl'),'utf8').split(/\r?\n/).filter(Boolean).flatMap(s=>{try{return [JSON.parse(s)];}catch{return [];}});}
async function main(){
 note('Waiting for primary native batch');
 for(;;){const r=rows(),latest=Object.fromEntries(r.map(x=>[x.id,x]));const text=fs.readFileSync(path.join(work,'status.txt'),'utf8').trim().split(/\r?\n/).pop();if(Object.keys(latest).length===jobs.length&&/DONE attempted=/.test(text))break;await new Promise(r=>setTimeout(r,5000));}
 for(;;){const summary=JSON.parse(fs.readFileSync(path.join(work,'summary.json')));if(summary.renderAttempted===jobs.length&&!summary.pending)break;await new Promise(r=>setTimeout(r,5000));}
 const latest=Object.fromEntries(rows().map(x=>[x.id,x]));
 const checks=JSON.parse(fs.readFileSync(path.join(work,'media-checks.json')));
 const ids=jobs.filter(j=>{
  if(j.kind==='motion'&&fs.readFileSync(j.source).includes(Buffer.from('ADBE Position')))return true;
  if(latest[j.id]?.kind!==j.kind)return true;
  if((latest[j.id]?.effects||[]).some(s=>/^Twixtor/.test(s)))return true;
  const r=latest[j.id],c=checks[j.id];return r?.status==='failed'&&!/较新版本|缺少预设所需效果插件/.test(r.info)||c?.status==='failed'&&r?.status==='success';
 }).map(j=>j.id);
 const forceIds=ids.filter(id=>latest[id].status!=='success'||checks[id]?.status!=='success'||latest[id].kind!==jobs.find(j=>j.id===id).kind||(latest[id].effects||[]).some(s=>/^Twixtor/.test(s)));
 fs.writeFileSync(path.join(work,'run.json'),JSON.stringify({ids,forceIds,retry:true,skipUnchanged:true,normalizeNull:true,syntheticMotion:true,rawDir:'raw-fixed',quit:true}));
 fs.writeFileSync(path.join(work,'retry-ids.json'),JSON.stringify(ids,null,2));
 const temp=path.join(process.env.TEMP,'yuehai-batch-fixed.jsx');fs.writeFileSync(temp,'\uFEFF'+fs.readFileSync(path.join(work,'render-batch.jsx'),'utf8').replace(/^\uFEFF/,''));
 note('Starting final correction pass: '+ids.length+' presets');
 const child=cp.spawn(native,['-m','-r',temp],{windowsHide:true,stdio:'ignore'});
 await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code)=>code===0?resolve():reject(Error('AE correction exited '+code)));});
 note('Correction process exited; verifying result coverage');
 const actual=rows().slice(jobs.length),attempted=new Set(actual.map(r=>r.id));
 const missing=ids.filter(id=>!attempted.has(id));
 if(missing.length)throw Error('Correction results missing: '+missing.join(','));
 note('COMPLETE corrections='+ids.length);
}
main().catch(e=>{note('ERROR '+e.stack);process.exitCode=1;});
