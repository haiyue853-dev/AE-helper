const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const work=path.join(root,'artifacts/preset-batch');
const output=path.join(root,'YueHaiAssistant/assets/my-presets');
const install=path.join(process.env.APPDATA,'Adobe/CEP/extensions/YueHaiAssistant');
const jobs=JSON.parse(fs.readFileSync(path.join(work,'jobs.json'),'utf8'));
const ffmpeg='D:/Topaz/ffmpeg.exe',ffprobe='D:/Topaz/ffprobe.exe';
const checksFile=path.join(work,'media-checks.json');
let checks=fs.existsSync(checksFile)?JSON.parse(fs.readFileSync(checksFile,'utf8')):{};
function run(exe,args){return cp.execFileSync(exe,args,{maxBuffer:32*1024*1024,windowsHide:true});}
function pixels(file,at){const args=['-v','error'];if(at!==undefined)args.push('-ss',String(at));args.push('-i',file,'-vf','scale=64:64','-frames:v','1','-pix_fmt','rgba','-f','rawvideo','-');const b=run(ffmpeg,args);if(b.length!==64*64*4)throw Error('无法解码预览帧');let sum=0,sq=0,alpha=0;for(let i=0;i<b.length;i+=4){const v=(b[i]+b[i+1]+b[i+2])/3;sum+=v;sq+=v*v;alpha+=b[i+3];}const m=sum/4096;return {mean:m,deviation:Math.sqrt(Math.max(0,sq/4096-m*m)),alpha:alpha/4096};}
function copy(relative){const from=path.join(output,relative),to=path.join(install,'assets/my-presets',relative);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
function processMedia(job,r){
 const rel=job.relative.replace(/\.ffx$/i,''),dest=path.join(output,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});
 if(r.status!=='success'){
  for(const ext of ['.png','.mp4'])for(const base of [output,path.join(install,'assets/my-presets')]){const file=path.join(base,rel+ext);if(fs.existsSync(file))fs.unlinkSync(file);}
  return {status:'failed',info:/较新版本|newer version/i.test(r.info)?'需要更高版本的 After Effects，当前 AE 2023 无法应用。':r.info};
 }
 try{
  const png=dest+'.png';
  if(job.kind==='color'){
   run(ffmpeg,['-v','error','-y','-i',r.file,'-vf',`crop=1179:1455:${r.cropX}:${r.cropY}`,'-frames:v','1',png]);
   const stat=pixels(png);if(stat.mean<2||stat.deviation<.8||stat.alpha<1)throw Error('AE 输出为空白或纯色，未提供该预览');
   copy(rel+'.png');return {status:'success',media:'png',width:1179,height:1455,stats:stat};
  }
  const probe=JSON.parse(run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',r.file]));
  const video=probe.streams.find(s=>s.codec_type==='video');
  if(!video||video.codec_name!=='h264'||video.width!==1088||video.height!==1344)throw Error('视频编码或竖屏尺寸不正确');
  if(probe.streams.some(s=>s.codec_type==='audio'))throw Error('预览中存在意外音频');
  const duration=Number(probe.format.duration);
  if(duration+1/24<r.duration||duration+1/24<r.keyMax)throw Error('视频未覆盖完整关键帧范围');
  run(ffmpeg,['-v','error','-xerror','-i',r.file,'-map','0:v:0','-f','null','-']);
  const times=[0,.25,.5,.75,.95].map(x=>Math.min(duration-1/24,duration*x));
  if(r.keyMax>0){times.push(Math.max(0,r.keyMax*.25),Math.max(0,r.keyMax*.5),Math.max(0,r.keyMax-.05));}
  const sampled=times.map(time=>({time,...pixels(r.file,time)}));
  const best=sampled.sort((a,b)=>b.deviation-a.deviation)[0];
  if(best.deviation<.8||best.mean<1)throw Error('视频全程采样为空白或纯色，未提供该预览');
  fs.copyFileSync(r.file,dest+'.mp4');
  run(ffmpeg,['-v','error','-y','-ss',String(best.time),'-i',r.file,'-frames:v','1',png]);
  const contact=path.join(work,'contacts',job.id+'.jpg');fs.mkdirSync(path.dirname(contact),{recursive:true});
  run(ffmpeg,['-v','error','-y','-i',r.file,'-vf',`fps=${25/duration},scale=144:178,tile=5x5:padding=2:margin=2`,'-frames:v','1','-q:v','3',contact]);
  copy(rel+'.mp4');copy(rel+'.png');
  return {status:'success',media:'mp4',duration,width:video.width,height:video.height,frames:Number(video.nb_frames),keyMax:r.keyMax,posterTime:best.time,sampled,contact};
 }catch(e){for(const ext of ['.png','.mp4']){const file=dest+ext;if(fs.existsSync(file))fs.unlinkSync(file);const installed=path.join(install,'assets/my-presets',rel+ext);if(fs.existsSync(installed))fs.unlinkSync(installed);}return {status:'failed',info:'预览校验未通过：'+String(e.message).slice(0,1200)};}
}
function build(){
 const reviewFile=path.join(work,'review-rejections.json');
 const reviews=fs.existsSync(reviewFile)?JSON.parse(fs.readFileSync(reviewFile,'utf8')):{};
 const rows=fs.existsSync(path.join(work,'results.jsonl'))?fs.readFileSync(path.join(work,'results.jsonl'),'utf8').split(/\r?\n/).filter(Boolean).map(s=>{try{return JSON.parse(s);}catch{return null;}}).filter(Boolean):[];
 const results=Object.fromEntries(rows.map(r=>[r.id,r]));
 for(const job of jobs){
  const target=path.join(output,job.relative);if(!fs.existsSync(target)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(job.source,target);copy(job.relative);}
  const r=results[job.id];if(!r)continue;
  const stamp=JSON.stringify(r)+(r.file&&fs.existsSync(r.file)?'@'+fs.statSync(r.file).mtimeMs:'');
  const review=reviews[job.id];
  if(review?.stamp===stamp){
   const rel=job.relative.replace(/\.ffx$/i,'');
   for(const ext of ['.png','.mp4'])for(const base of [output,path.join(install,'assets/my-presets')]){const file=path.join(base,rel+ext);if(fs.existsSync(file))fs.unlinkSync(file);}
   checks[job.id]={status:'failed',info:review.info,stamp};fs.writeFileSync(checksFile,JSON.stringify(checks,null,2));continue;
  }
  if(checks[job.id]?.stamp===stamp)continue;
  checks[job.id]={...processMedia(job,r),stamp};
  fs.writeFileSync(checksFile,JSON.stringify(checks,null,2));
  console.log(`${job.id} ${checks[job.id].status} ${job.relative}${checks[job.id].info?' '+checks[job.id].info:''}`);
 }
 const entries=jobs.map(j=>({relative:j.relative,media:checks[j.id]?.status==='success'?checks[j.id].media:null}));
 const failures={},pending={},notes={};
 for(const j of jobs){const parts=j.relative.replace(/\.ffx$/i,'').split('/'),base=parts.pop(),id=parts.join('/')+'/'+base.toLowerCase(),c=checks[j.id];if(!c)pending[id]='正在批量制作，完成后刷新即可预览。';else if(c.status!=='success')failures[id]=c.info;const r=results[j.id];if(c?.status==='success'&&r?.fixes?.length)notes[id]=Array.from(new Set(r.fixes)).join('；');}
 const success=Object.values(checks).filter(c=>c.status==='success').length,failed=Object.values(checks).filter(c=>c.status!=='success').length;
 const description=`${success} 个预览已完成 · ${failed} 个暂不可用 · ${jobs.length-success-failed} 个待制作 · 保留原文件夹分类`;
 const script=`(function(){'use strict';var entries=${JSON.stringify(entries)},records=[];entries.forEach(function(e){var base=e.relative.replace(/\\.ffx$/i,'');var files=[e.relative];if(e.media){files.push(base+'.png');if(e.media==='mp4')files.push(base+'.mp4');}files.forEach(function(relative){records.push({name:relative.split('/').pop(),relativePath:relative,size:0,modified:0,url:function(){return 'assets/my-presets/'+relative.split('/').map(encodeURIComponent).join('/');}});});});window.YueHaiMyPresets={id:'yuehai-my-presets',name:'我的预设',portrait:true,description:${JSON.stringify(description)},failures:${JSON.stringify(failures)},pending:${JSON.stringify(pending)},notes:${JSON.stringify(notes)},records:records,release:function(){}};}());\n`;
 fs.writeFileSync(path.join(root,'YueHaiAssistant/js/my-presets.js'),script);fs.copyFileSync(path.join(root,'YueHaiAssistant/js/my-presets.js'),path.join(install,'js/my-presets.js'));
 const summary={total:jobs.length,renderAttempted:Object.keys(results).length,success,failed,pending:jobs.length-success-failed,updated:new Date().toISOString()};fs.writeFileSync(path.join(work,'summary.json'),JSON.stringify(summary,null,2));return summary;
}
if(process.argv.includes('--watch')){let previous='';for(;;){try{const s=build(),compact=JSON.stringify(s);if(compact.replace(/,"updated":.*$/,'')!==previous){console.log(JSON.stringify(s));previous=compact.replace(/,"updated":.*$/,'');}const finish=path.join(work,'finisher.txt');if(!s.pending&&fs.existsSync(finish)&&/COMPLETE corrections=/.test(fs.readFileSync(finish,'utf8')))break;}catch(e){console.error(e.stack);}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5000);}}
else console.log(JSON.stringify(build(),null,2));
