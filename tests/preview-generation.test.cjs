const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const generation=require('../YueHaiAssistant/js/preview-generation.cjs');

test('按缺失、失败和单项生成时保留其他任务记录，换底图不会让旧预览误判为可复用',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'yuehai-scope-')),source=path.join(root,'Presets'),output=path.join(root,'预览'),image=path.join(root,'底图.png');
 try{
  fs.mkdirSync(source);fs.mkdirSync(output);fs.writeFileSync(image,'image');
  for(const name of ['完成','失败','缺失'])fs.writeFileSync(path.join(source,name+'.ffx'),'motion');
  const jobs=generation.scanPresets(source,output),signature=file=>{const s=fs.statSync(file);return file.replace(/\\/g,'/')+'|'+s.size+'|'+s.mtimeMs;};
  const manifest={version:1,sourceRoot:source,imageSignature:signature(image),renderSignature:JSON.stringify(['adc',4,2]),jobs:{}};
  for(const job of jobs)if(job.name!=='缺失')manifest.jobs[job.relative]={signature:job.signature,status:job.name==='完成'?'success':'failed',info:'缺少插件',owned:true,ffxOwned:true};
  fs.writeFileSync(path.join(output,'完成.mp4'),'video');fs.writeFileSync(path.join(output,'完成.png'),'image');
  const write=()=>fs.writeFileSync(path.join(output,'.yuehai-preview.json'),JSON.stringify(manifest));
  const options={presetRoot:source,outputRoot:output,image,presetBase:source};write();
  let prepared=generation.prepare({...options,mode:'missing'});assert.deepEqual(prepared.config.jobs.map(j=>j.name),['缺失']);assert.equal(prepared.manifest.jobs['完成.ffx'].status,'success');assert.equal(prepared.manifest.jobs['失败.ffx'].status,'failed');
  write();prepared=generation.prepare({...options,mode:'failed'});assert.deepEqual(prepared.config.jobs.map(j=>j.name),['失败']);
  write();prepared=generation.prepare({...options,relativePaths:['完成.ffx'],reuse:false});assert.deepEqual(prepared.config.jobs.map(j=>j.name),['完成']);assert.equal(prepared.manifest.jobs['失败.ffx'].status,'failed');
  write();fs.appendFileSync(image,'new');prepared=generation.prepare({...options,relativePaths:['失败.ffx']});
  const other=jobs.find(j=>j.name==='完成');assert.equal(generation.jobAction(other,prepared.manifest,signature(image),true,true),'render');
  write();assert.throws(()=>generation.prepare({...options,relativePaths:['../别人的.ffx']}),/预设|范围/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('默认输出统一到助手目录，保留预设的多级文件夹；外部预设使用自身文件夹名',()=>{
 const root=generation.defaults().storageRoot;
 assert.equal(generation.defaultOutput('D:/AE/Presets/工具箱/文字','D:/AE/Presets'),root+'/工具箱/文字');
 assert.equal(generation.defaultOutput('E:/我的转场','D:/AE/Presets'),root+'/我的转场');
 assert.equal(generation.defaultOutput('D:/AE/Presets','D:/AE/Presets'),root);
});

test('整库单项重做识别之前在子文件夹生成的预览，不把自己的视频误认成外来文件',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'yuehai-child-output-')),source=path.join(root,'Presets'),output=path.join(root,'预览'),image=path.join(root,'底图.png');
 try{
  fs.mkdirSync(path.join(source,'转场'),{recursive:true});fs.writeFileSync(path.join(source,'转场','a.ffx'),'motion');fs.writeFileSync(image,'image');
  const child=generation.prepare({presetRoot:path.join(source,'转场'),outputRoot:path.join(output,'转场'),image,presetBase:source});
  const manifest=child.manifest;manifest.activeRun=null;manifest.jobs['a.ffx'].status='success';manifest.jobs['a.ffx'].owned=true;
  fs.writeFileSync(child.manifestPath,JSON.stringify(manifest));fs.writeFileSync(path.join(output,'转场','a.mp4'),'video');fs.writeFileSync(path.join(output,'转场','a.png'),'png');
  const prepared=generation.prepare({presetRoot:source,outputRoot:output,image,presetBase:source,relativePaths:['转场/a.ffx'],reuse:false});
  assert.equal(prepared.initial.length,0);assert.equal(prepared.config.jobs.length,1);assert.equal(prepared.manifest.jobs['转场/a.ffx'].ffxOwned,true);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('扫描所有子文件夹，输出与预设同名，排除输出目录和重复扫描',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'yuehai-preview-test-'));
 try{
  const presets=path.join(root,'预设'),out=path.join(presets,'_YueHai预览');
  fs.mkdirSync(path.join(presets,'一级','二级'),{recursive:true});fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(presets,'一级','二级','同名.ffx'),'ADBE Text Document');
  fs.writeFileSync(path.join(presets,'一级','同名.ffx'),'motion');fs.writeFileSync(path.join(out,'忽略.ffx'),'x');
  const previousOutput=path.join(presets,'以前的预览');fs.mkdirSync(previousOutput);fs.writeFileSync(path.join(previousOutput,'.yuehai-preview.json'),JSON.stringify({version:1,jobs:{}}));fs.writeFileSync(path.join(previousOutput,'也忽略.ffx'),'x');
  const jobs=generation.scanPresets(presets,out);
  assert.equal(jobs.length,2);assert.equal(jobs.find(j=>j.kind==='text').relative,'一级/二级/同名.ffx');
  assert.ok(jobs.every(j=>j.video===j.relative.replace(/\.ffx$/i,'.mp4')));
  assert.equal(new Set(jobs.map(j=>j.video)).size,2);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('独立 AE 进程崩溃后记录失败，继续后面的预设；重复恢复不重复渲染',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'yuehai-worker-test-'));
 try{
  fs.mkdirSync(path.join(root,'raw'));
  const jobs=[{id:'1',name:'坏插件'},{id:'2',name:'正常转场'}],prepared={runId:path.basename(root),runDir:root,config:{jobs:jobs},jobs:jobs};
  let launches=0;
  const spawn=(exe,args)=>{launches++;const dir=path.join(root,'worker-'+launches);
   if(dir.endsWith('worker-2'))fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify([{id:'2',name:'正常转场',status:'success',file:'2.mp4'}]));
   return {pid:2147483647,on:function(){}};
  };
  await generation.launchWorkers(prepared,path.join(root,'AE.exe'),path.resolve(__dirname,'../YueHaiAssistant/jsx/preview-engine.jsx'),spawn);
  const result=JSON.parse(fs.readFileSync(path.join(root,'results.json')));
  assert.equal(result.length,2);assert.equal(result[0].status,'failed');assert.match(result[0].info,/异常退出/);assert.equal(result[1].status,'success');
  await generation.launchWorkers(prepared,path.join(root,'AE.exe'),path.resolve(__dirname,'../YueHaiAssistant/jsx/preview-engine.jsx'),spawn);assert.equal(launches,2);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'progress.json'))).status,'done');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('只有图片和预设均未改变且成功文件存在时复用；外来同名视频不会覆盖',()=>{
 const job={relative:'文字/a.ffx',signature:'preset-v2',video:'文字/a.mp4'};
 const manifest={imageSignature:'image-v1',jobs:{'文字/a.ffx':{status:'success',signature:'preset-v2'}}};
 assert.equal(generation.jobAction(job,manifest,'image-v1',true,true),'cached');
 assert.equal(generation.jobAction(job,manifest,'image-v2',true,true),'render');
 assert.equal(generation.jobAction({...job,signature:'changed'},manifest,'image-v1',true,true),'render');
 assert.equal(generation.jobAction(job,{},'image-v1',true,true),'conflict');
 assert.equal(generation.jobAction(job,{jobs:{'文字/a.ffx':{status:'failed',owned:false}}},'image-v1',true,true),'conflict');
 assert.equal(generation.jobAction(job,manifest,'image-v1',false,true),'render');
});
