const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Admin/AppData/Local/Programs/Rea/cli/node_modules/rea-agents/node_modules/playwright-core');
const generation=require('../YueHaiAssistant/js/preview-generation.cjs');
const root=path.resolve(__dirname,'..'),work=path.join(root,'artifacts/automatic-preview-smoke');
(async()=>{
 const rendered=JSON.parse(fs.readFileSync(path.join(work,'latest.json'))),native=JSON.parse(fs.readFileSync(path.join(work,'native-check.json')));
 for(const field of ['projectPreserved','queuePreserved','viewerPreserved','gpuPreserved'])assert.equal(native[field],true,field);
 assert.equal(native.results.filter(r=>r.status==='success').length,3);assert.equal(native.results.length,4);
 const prepared=generation.prepare({image:rendered.manifest.image,presetRoot:rendered.manifest.sourceRoot,outputRoot:path.join(work,'published-'+Date.now()),presetBase:rendered.manifest.sourceRoot,minimumDuration:2,text:'adc'});
 const replay=native.results.map(result=>{const copy={...result};const job=prepared.config.jobs.find(j=>j.id===copy.id);if(copy.status==='success'){fs.copyFileSync(copy.file,job.nativeFile);copy.file=job.nativeFile;}return copy;});
 fs.writeFileSync(path.join(prepared.runDir,'results.json'),JSON.stringify(replay));fs.writeFileSync(path.join(prepared.runDir,'progress.json'),JSON.stringify({status:'done',completed:4}));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:440,height:900}}),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.route('**/__preview_test__/**',async route=>{
   try{
    const url=new URL(route.request().url()),file=path.resolve(url.searchParams.get('path')||work);
    const allowed=path.join(root,'artifacts')+path.sep;assert.ok(file.startsWith(allowed),'Fixture stays in artifacts');
    if(url.pathname.endsWith('/fs')){
     let data;switch(url.searchParams.get('action')){case'readdir':data=fs.readdirSync(file);break;case'stat':{const s=fs.statSync(file);data={isDirectory:s.isDirectory(),size:s.size,mtime:s.mtimeMs};break;}case'readFile':data=fs.readFileSync(file,'utf8');break;}
     await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({err:0,data})});return;
    }
    const bytes=fs.readFileSync(file),range=route.request().headers().range,match=range&&/^bytes=(\d+)-(\d*)$/.exec(range);
    const headers={'Accept-Ranges':'bytes','Cache-Control':'no-cache'};let body=bytes,status=200;
    if(match){const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),bytes.length-1):bytes.length-1;status=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+bytes.length;body=bytes.subarray(start,end+1);}
    await route.fulfill({status,headers,body,contentType:/\.mp4$/i.test(file)?'video/mp4':/\.png$/i.test(file)?'image/png':'application/octet-stream'});
   }catch(e){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({err:1,data:''})});}
  });
  await page.addInitScript(()=>{
   function call(action,path){var xhr=new XMLHttpRequest();xhr.open('GET','/__preview_test__/fs?action='+action+'&path='+encodeURIComponent(path),false);xhr.send();return JSON.parse(xhr.responseText);}
   window.cep={fs:{readdir:path=>call('readdir',path),stat:path=>call('stat',path),readFile:path=>call('readFile',path)}};
   window.cep_node={require:name=>{if(name==='buffer')return{Buffer:{from:base64=>base64}};throw Error('Unexpected fixture require: '+name);}};
   window.__adobe_cep__={evalScript:(script,callback)=>callback('D:/AE/Presets')};
  });
  let host=fs.readFileSync(path.join(root,'YueHaiAssistant/js/host.js'),'utf8');
  host=host.replace('function fileUrl(path) {',"function fileUrl(path) { return '/__preview_test__/media?path='+encodeURIComponent(path);");
  host=host.replace('window.YueHaiHost = {','window.YueHaiHost = { createPosterForTest: createPoster,');
  await page.route('**/js/host.js',route=>route.fulfill({contentType:'application/javascript',body:host}));
  await page.goto('http://127.0.0.1:4173/');
  const publish=async(activate)=>page.evaluate(async args=>{const lib=await window.YueHaiHost.readCepFolder(args.output);document.dispatchEvent(new CustomEvent('yuehai:preview-library',{detail:{library:lib,activate:args.activate}}));},{output:prepared.output,activate});
  await publish(true);
  const progress=[];
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Publishing did not complete')),90000);
   new generation.Run(prepared,{
    poster:async result=>Buffer.from(await page.evaluate(r=>window.YueHaiHost.createPosterForTest(r),result),'base64'),
    library:()=>publish(false),error:e=>{clearTimeout(timer);reject(e);},
    progress:p=>{progress.push(p);if(p.status!=='running'){clearTimeout(timer);resolve();}}
   }).start();
  });
  const manifest=JSON.parse(fs.readFileSync(prepared.manifestPath));assert.equal(manifest.success,3);assert.equal(manifest.failed,1);assert.equal(manifest.activeRun,null);
  const identical={...replay.find(r=>r.status==='success')};identical.reference=identical.file;
  await assert.rejects(page.evaluate(r=>window.YueHaiHost.createPosterForTest(r),identical),/空白|粒子/);
  for(const result of native.results.filter(r=>r.status==='success')){
   const job=prepared.jobs.find(j=>j.id===result.id),video=path.join(prepared.output,job.video),poster=video.replace(/\.mp4$/i,'.png');assert.ok(fs.existsSync(video));assert.ok(fs.existsSync(poster));
   const probe=JSON.parse(cp.execFileSync('D:/Topaz/ffprobe.exe',['-v','error','-show_streams','-show_format','-of','json',video],{windowsHide:true}));
   assert.equal(probe.streams.some(s=>s.codec_type==='audio'),false);assert.ok(Number(probe.format.duration)+1/24>=result.keyMax);
   cp.execFileSync('D:/Topaz/ffmpeg.exe',['-v','error','-xerror','-i',video,'-map','0:v:0','-f','null','-'],{windowsHide:true});
  }
  await page.locator('#librarySelect').selectOption(JSON.stringify(['yuehai-my-presets','文字']));assert.equal(await page.locator('.asset-card').count(),1);
  await page.locator('.poster').evaluate(img=>img.decode());await page.locator('.asset-card').hover();await page.waitForFunction(()=>document.querySelector('.asset-card video')?.videoHeight===1344);
  await page.reload();await page.locator('#librarySelect').selectOption(JSON.stringify(['yuehai-my-presets','文字']));assert.equal(await page.locator('.asset-card .poster').count(),1);
  await page.screenshot({path:path.join(root,'artifacts/automatic-preview-real-result.png'),fullPage:true});
  const second=generation.prepare({image:prepared.manifest.image,presetRoot:prepared.manifest.sourceRoot,outputRoot:prepared.output,presetBase:prepared.manifest.sourceRoot,minimumDuration:2,text:'adc'});
  assert.equal(second.initial.filter(r=>r.cached).length,3);assert.equal(second.config.jobs.length,1);
  new generation.Run(second,{progress:()=>{},library:async()=>{},error:()=>{},poster:async()=>Buffer.alloc(0)}).abort(new Error('Cache test only; no rerender requested'));
  assert.deepEqual(pageErrors,[]);
  console.log(JSON.stringify({status:'PASS',nativeRendered:3,failedPresetReported:1,realCanvasPosters:3,fullVideoDecode:true,noAudio:true,namedAfterPresets:true,autoPanelMerge:true,restoredAfterReload:true,cachedWithoutRerender:3,projectAndQueuePreserved:true},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
