const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let backend;try{backend=require('../YueHaiAssistant/js/subtitle-jobs.cjs');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
test('同名视频多次识别分开保存，校对后的 SRT 使用视频原名且不修改视频',()=>{
 assert.ok(backend,'本地字幕任务尚未实现');
 const source=path.resolve(__dirname,'../artifacts/subtitle-unit-source.mp4');fs.writeFileSync(source,'test-fixture');let first,second;
 try{
  first=backend.create({video:source,language:'auto',maxChars:22});second=backend.create({video:source,language:'zh',maxChars:22});
  assert.notEqual(first.directory,second.directory);assert.ok(first.directory.startsWith(path.resolve(__dirname,'../字幕')+path.sep));
  const result=backend.save(first.directory,[{start:0,end:1.25,text:'校对后的中文'}]);
  assert.equal(path.basename(result.srt),'subtitle-unit-source.srt');assert.match(fs.readFileSync(result.srt,'utf8'),/00:00:00,000 --> 00:00:01,250/);assert.match(fs.readFileSync(result.srt,'utf8'),/校对后的中文/);assert.equal(fs.readFileSync(source,'utf8'),'test-fixture');
  assert.throws(()=>backend.save(first.directory,[{start:2,end:1,text:'无效'}]),/时间/);
 }finally{fs.unlinkSync(source);for(const job of [first,second])if(job)fs.rmSync(job.directory,{recursive:true,force:true});}
});
test('拒绝不存在的输入和字幕输出目录之外的任务路径',()=>{
 assert.ok(backend,'本地字幕任务尚未实现');assert.throws(()=>backend.create({video:'D:/missing-yuehai-video.mp4'}),/视频|文件/);assert.throws(()=>backend.load('C:/Windows'),/字幕目录/);
});
test('影视精度和快速模式保留各自模型，CPU 选择不会更换模型',()=>{
 const source=path.resolve(__dirname,'../artifacts/subtitle-device-source.mp4');fs.writeFileSync(source,'fixture');const jobs=[];
 try{for(const quality of ['accurate','fast'])for(const device of ['auto','cpu']){const job=backend.create({video:source,quality,device});jobs.push(job);assert.equal(job.quality,quality);assert.equal(job.device,device);assert.match(job.nativeModel,quality==='accurate'?/large-v3-q5_0/:/small-q5_1/);assert.match(job.nativeEngine,/YueHaiAsr\.exe$/);}}
 finally{fs.unlinkSync(source);for(const job of jobs)fs.rmSync(job.directory,{recursive:true,force:true});}
});
test('AE 图层任务保存剪辑范围，导入使用任务原图层而不是当前时间指针',()=>{
 const source=path.resolve(__dirname,'../artifacts/subtitle-layer-source.mp4');fs.writeFileSync(source,'fixture');let job;
 const sourceLayer={compId:12,layerId:27,layerIndex:2,layerName:'剪辑',compName:'合成',video:source,offset:4,sourceIn:1.6,sourceOut:6.4,stretch:125,inPoint:4,outPoint:10,startTime:2};
 try{job=backend.create({video:source,sourceLayer});assert.deepEqual(job.sourceLayer,sourceLayer);
 const script=fs.readFileSync(backend.importConfig(job.directory,[{start:0,end:1,text:'图层字幕'}],'layer'),'utf8');assert.match(script,/"sourceLayer":\{/);assert.match(script,/"compId":12/);assert.match(script,/"mode":"layer"/);
 }finally{fs.unlinkSync(source);if(job)fs.rmSync(job.directory,{recursive:true,force:true});}
});
