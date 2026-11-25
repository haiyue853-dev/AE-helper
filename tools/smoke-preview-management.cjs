const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const generation=require('../YueHaiAssistant/js/preview-generation.cjs'),catalog=require('../YueHaiAssistant/js/preset-library.cjs');
const {chromium}=require('C:/Users/Admin/AppData/Local/Programs/Rea/cli/node_modules/rea-agents/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),work=path.join(root,'artifacts','preview-management-native',String(Date.now())),source=path.join(work,'source'),output=path.join(work,'output');
(async()=>{
 fs.mkdirSync(path.join(source,'调色'),{recursive:true});fs.mkdirSync(output,{recursive:true});
 fs.copyFileSync('D:/AE2023/Adobe After Effects 2023/Support Files/Presets/调色2/(b站)SaRos-cc1.ffx',path.join(source,'调色','单项.ffx'));
 fs.writeFileSync(path.join(source,'保留.ffx'),'unused fixture');
 fs.writeFileSync(path.join(output,'.yuehai-preview.json'),JSON.stringify({version:1,sourceRoot:source,jobs:{'保留.ffx':{status:'failed',info:'保留原来的失败记录',signature:generation.scanPresets(source,output).find(j=>j.name==='保留').signature}}}));
 const prepared=generation.prepare({presetRoot:source,presetBase:source,outputRoot:output,image:path.join(root,'预览图.jpg'),relativePaths:['调色/单项.ffx'],reuse:false,minimumDuration:2});
 assert.equal(prepared.config.jobs.length,1);
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage();await page.route('**/__native_preview__?**',route=>{
   const file=path.resolve(new URL(route.request().url()).searchParams.get('file'));assert.ok(file.startsWith(work+path.sep));
   const bytes=fs.readFileSync(file),match=/^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range||''),headers={'Accept-Ranges':'bytes','Access-Control-Allow-Origin':'*'};let body=bytes,status=200;
   if(match){const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),bytes.length-1):bytes.length-1;status=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+bytes.length;body=bytes.subarray(start,end+1);}
   return route.fulfill({status,headers,body,contentType:'video/mp4'});
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(()=>window.cep_node={require:name=>{if(name==='buffer')return {Buffer:{from:data=>data}};throw Error(name);}});
  let host=fs.readFileSync(path.join(root,'YueHaiAssistant/js/host.js'),'utf8').replace('function fileUrl(path) {',"function fileUrl(path) { return '/__native_preview__?file='+encodeURIComponent(path);").replace('window.YueHaiHost = {','window.YueHaiHost = {posterForTest:createPoster,');
  await page.addScriptTag({content:host});
  let last='';const done=new Promise((resolve,reject)=>{const run=new generation.Run(prepared,{poster:async result=>Buffer.from(await page.evaluate(r=>window.YueHaiHost.posterForTest(r),result),'base64'),library:async()=>{},error:reject,progress:progress=>{const message=progress.status+' '+progress.completed+'/'+progress.total+' '+progress.current;if(message!==last){last=message;console.log(message);}if(progress.status!=='running')resolve(progress);}}).start();
   generation.launchWorkers(prepared,'D:/AE2023/Adobe After Effects 2023/Support Files/AfterFX.exe',path.join(root,'YueHaiAssistant/jsx/preview-engine.jsx')).catch(error=>run.abort(error));
  });
  const result=await done;assert.equal(result.success,1,JSON.stringify(result));
  const library=catalog.refresh(source,{storageRoot:output});assert.equal(library.previewStates['调色/单项'],'ready');assert.equal(library.previewStates['/保留'],'failed');
  const video=path.join(output,'调色','单项.mp4');cp.execFileSync('D:/Topaz/ffmpeg.exe',['-v','error','-xerror','-i',video,'-map','0:v:0','-f','null','-'],{windowsHide:true});
  const probe=JSON.parse(cp.execFileSync('D:/Topaz/ffprobe.exe',['-v','error','-show_streams','-show_format','-of','json',video],{windowsHide:true}));assert.equal(probe.streams.some(s=>s.codec_type==='audio'),false);
  const report={ok:true,selectedJobs:1,preservedOtherRecord:true,posterValidated:true,fullVideoDecode:true,noAudio:true,output};fs.writeFileSync(path.join(root,'artifacts','preview-management-native','report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
