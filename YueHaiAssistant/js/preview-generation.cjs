'use strict';
var fs=require('fs'),path=require('path');
function slash(p){return p.replace(/\\/g,'/');}
function mkdir(p){fs.mkdirSync(p,{recursive:true});}
function samePath(a,b){a=path.resolve(a);b=path.resolve(b);return process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;}
function readJson(p,fallback){try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){return fallback;}}
function defaults(){return readJson(path.join(__dirname,'../preview-settings.json'),{});}
function defaultOutput(source,base){
 var settings=defaults(),root=settings.storageRoot||path.resolve(__dirname,'../../预览素材');
 var relative=base?path.relative(path.resolve(base),path.resolve(source)):path.basename(source);
 if(relative==='..'||relative.indexOf('..'+path.sep)===0||path.isAbsolute(relative))relative=path.basename(source);
 return slash(path.join(root,relative));
}
function signature(p){var s=fs.statSync(p);return slash(path.resolve(p))+'|'+s.size+'|'+s.mtimeMs;}
function scanPresets(root,output){
 root=path.resolve(root);output=path.resolve(output);var jobs=[];
 function visit(dir){fs.readdirSync(dir).sort().forEach(function(name){
  if(name.charAt(0)==='.')return;
  var absolute=path.join(dir,name),stat=fs.lstatSync(absolute);
  if(stat.isSymbolicLink())return;
  if(stat.isDirectory()){var generated=readJson(path.join(absolute,'.yuehai-preview.json'),null);if(!samePath(absolute,output)&&!(generated&&generated.version===1&&generated.jobs))visit(absolute);return;}
  if(!/\.ffx$/i.test(name))return;
  var relative=slash(path.relative(root,absolute)),raw=fs.readFileSync(absolute).toString('latin1');
  var kind=/ADBE Text/.test(raw)||/文本|字体|文字/i.test(relative)?'text':/tc Particular/.test(raw)?'particle':/ADBE Vector/.test(raw)?'shape':/调色|(^|\/)cc[^/]*\.ffx$/i.test(relative)?'color':'motion';
  jobs.push({id:String(jobs.length+1),relative:relative,name:name.replace(/\.ffx$/i,''),source:slash(absolute),signature:signature(absolute),kind:kind,video:relative.replace(/\.ffx$/i,'.mp4')});
 });}
 visit(root);return jobs;
}
function jobAction(job,manifest,imageSignature,videoExists,reuse){
 var previous=manifest.jobs&&manifest.jobs[job.relative];
 if(videoExists&&(!previous||previous.owned===false))return 'conflict';
 if(reuse&&videoExists&&previous&&previous.status==='success'&&previous.signature===job.signature&&(previous.imageSignature||manifest.imageSignature)===imageSignature)return 'cached';
 return 'render';
}
function itemId(relative,prefix){var parts=relative.replace(/\.ffx$/i,'').split('/'),base=parts.pop();return (prefix?prefix+'/':'')+parts.join('/')+'/'+base.toLowerCase();}
function metadata(manifest){
 manifest.failures={};manifest.pending={};var success=0,failed=0;
 Object.keys(manifest.jobs).forEach(function(relative){var r=manifest.jobs[relative],id=itemId(relative,'');
  if(r.status==='success')success++;else if(r.status==='failed'){failed++;manifest.failures[id]=r.info;}else manifest.pending[id]='正在自动制作预览…';
 });
 manifest.description='自动预览 · '+success+' 个完成 · '+failed+' 个失败';manifest.success=success;manifest.failed=failed;
}
function inheritOutputJobs(source,output,jobs,previous){
 var cache={},rootFile=path.join(output,'.yuehai-preview.json'),rootTime=fs.existsSync(rootFile)?fs.statSync(rootFile).mtimeMs:0;
 previous.jobs=previous.jobs||{};
 jobs.forEach(function(job){
  var dir=path.dirname(path.join(output,job.relative));
  while(!samePath(dir,output)){
   var relative=path.relative(output,dir);if(relative==='..'||relative.indexOf('..'+path.sep)===0||path.isAbsolute(relative))break;
   if(!Object.prototype.hasOwnProperty.call(cache,dir)){var file=path.join(dir,'.yuehai-preview.json');cache[dir]={manifest:readJson(file,null),modified:fs.existsSync(file)?fs.statSync(file).mtimeMs:0};}
   var candidate=cache[dir],manifest=candidate.manifest;
   if(manifest&&manifest.sourceRoot){
    var childRelative=slash(path.relative(path.resolve(manifest.sourceRoot),path.resolve(job.source))),entry=manifest.jobs&&manifest.jobs[childRelative];
    if(entry&&samePath(path.join(dir,childRelative),path.join(output,job.relative))){
     if(manifest.activeRun){var active=readJson(path.join(manifest.activeRun,'progress.json'),null);if(active&&active.status==='running')throw Error('子文件夹有尚未结束的任务，请先停止或等待完成。');}
     if(!previous.jobs[job.relative]||candidate.modified>rootTime)previous.jobs[job.relative]=Object.assign({imageSignature:manifest.imageSignature,renderSignature:manifest.renderSignature},entry);
     break;
    }
   }
   var parent=path.dirname(dir);if(parent===dir)break;dir=parent;
  }
 });
}
function prepare(options){
 var source=path.resolve(options.presetRoot),output=path.resolve(options.outputRoot||defaultOutput(source,options.presetBase)),image=path.resolve(options.image);
 if(!fs.statSync(image).isFile())throw Error('请选择一张有效图片。');
 if(!fs.statSync(source).isDirectory())throw Error('请选择预设文件夹。');
 var jobs=scanPresets(source,output);if(!jobs.length)throw Error('这个文件夹及其子文件夹里没有 FFX 预设。');
 var manifestPath=path.join(output,'.yuehai-preview.json'),previous=readJson(manifestPath,{}),imageSignature=signature(image);
 if(previous.activeRun){var oldProgress=readJson(path.join(previous.activeRun,'progress.json'),null);if(oldProgress&&oldProgress.status==='running')throw Error('这个输出目录有尚未结束的任务，请先恢复或停止该任务。');}
 if(Array.isArray(options.relativePaths)){
  if(!options.relativePaths.length||options.relativePaths.some(function(relative){return !jobs.some(function(job){return job.relative===relative;});}))throw Error('指定预设已不存在或超出本次生成范围，请刷新后重试。');
  jobs=jobs.filter(function(job){return options.relativePaths.indexOf(job.relative)!==-1;});
 }
 inheritOutputJobs(source,output,jobs,previous);
 if(options.mode==='missing'||options.mode==='failed')jobs=jobs.filter(function(job){var old=previous.jobs&&previous.jobs[job.relative],exists=fs.existsSync(path.join(output,job.video))||fs.existsSync(path.join(output,job.video.replace(/\.mp4$/i,'.png')));return options.mode==='failed'?old&&old.status==='failed':!old||old.signature!==job.signature||(!exists&&old.status!=='failed');});
 if(!jobs.length)throw Error(options.mode==='failed'?'没有需要重试的失败预设。':'没有需要补齐的预览。');
 mkdir(output);
 var base=options.presetBase&&path.resolve(options.presetBase),relativeBase=base?path.relative(base,source):'..';
 var prefix=base&&relativeBase!== '..'&&relativeBase.indexOf('..'+path.sep)!==0&&!path.isAbsolute(relativeBase)?slash(relativeBase):path.basename(source);
 var runId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),runDir=path.join(output,'.yuehai-run-'+runId);mkdir(path.join(runDir,'raw'));
 var preserved={};Object.keys(previous.jobs||{}).forEach(function(key){preserved[key]=Object.assign({imageSignature:previous.imageSignature,renderSignature:previous.renderSignature},previous.jobs[key]);});
 var manifest={version:1,sourceRoot:slash(source),sourceName:path.basename(source),prefix:prefix,image:slash(image),imageSignature:imageSignature,portrait:previous.portrait!==undefined?previous.portrait:true,jobs:preserved,activeRun:slash(runDir)};
 var renderSignature=JSON.stringify([options.text||'adc',Math.max(1,Math.min(60,Number(options.minimumDuration)||4)),2]);manifest.renderSignature=renderSignature;
 var queued=[],initial=[];
 jobs.forEach(function(job){
  var oldEntry=previous.jobs&&previous.jobs[job.relative];
  var action=jobAction(job,previous,imageSignature,fs.existsSync(path.join(output,job.video))||(job.kind==='color'&&fs.existsSync(path.join(output,job.video.replace(/\.mp4$/i,'.png')))),options.reuse!==false&&((oldEntry&&oldEntry.renderSignature)||previous.renderSignature)===renderSignature),copy=path.join(output,job.relative),entry={signature:job.signature,imageSignature:imageSignature,renderSignature:renderSignature,status:'pending',info:'',owned:!!oldEntry&&oldEntry.owned!==false,ffxOwned:false};
  if(action==='cached'&&!fs.existsSync(path.join(output,job.video.replace(/\.mp4$/i,'.png'))))action='render';
  mkdir(path.dirname(copy));
  if(!samePath(copy,job.source)){
   if(fs.existsSync(copy)&&!(oldEntry&&oldEntry.ffxOwned)){
    if(!fs.readFileSync(copy).equals(fs.readFileSync(job.source)))action='conflict';
   }else{fs.copyFileSync(job.source,copy);entry.ffxOwned=true;}
  }
  if(action==='conflict'){entry.status='failed';entry.info='输出目录已有其他同名文件，未覆盖；请选择其他输出位置。';initial.push({id:job.id,status:'failed',name:job.name,info:entry.info});}
  else if(action==='cached'){entry=previous.jobs[job.relative];initial.push({id:job.id,status:'success',name:job.name,cached:true});}
  else{job.nativeFile=slash(path.join(runDir,'raw',job.id+'.mp4'));queued.push(job);}
  manifest.jobs[job.relative]=entry;
 });
 var config={runId:runId,runDir:slash(runDir),image:slash(image),minimumDuration:Math.max(1,Math.min(60,Number(options.minimumDuration)||4)),text:options.text||'adc',jobs:queued,total:jobs.length};
 metadata(manifest);fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
 var prepared={runId:runId,runDir:runDir,output:output,manifestPath:manifestPath,manifest:manifest,config:config,jobs:jobs,initial:initial};
 fs.writeFileSync(path.join(runDir,'run.json'),JSON.stringify(prepared));
 fs.writeFileSync(path.join(runDir,'config.jsx'),'\uFEFFvar YUEHAI_PREVIEW_CONFIG='+JSON.stringify(config).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';');
 return prepared;
}
function Run(prepared,callbacks){this.data=prepared;this.callbacks=callbacks;this.processed={};this.results=prepared.initial.slice();this.closed=false;this.polling=false;this.timer=null;}
Run.prototype.emit=function(progress){this.callbacks.progress({total:this.data.jobs.length,completed:this.results.length,remaining:this.data.jobs.length-this.results.length,success:this.results.filter(function(r){return r.status==='success';}).length,failed:this.results.filter(function(r){return r.status==='failed';}).length,current:progress&&progress.current||'',status:progress&&progress.status||'running',error:progress&&progress.error||'',results:this.results.slice(-30),output:this.data.output});};
Run.prototype.save=function(){metadata(this.data.manifest);fs.writeFileSync(this.data.manifestPath,JSON.stringify(this.data.manifest,null,2));};
Run.prototype.publish=async function(result){
 var self=this,job=this.data.jobs.filter(function(j){return j.id===result.id;})[0];if(!job||this.processed[result.id])return;
 this.processed[result.id]=true;
 var previous=this.data.manifest.jobs[job.relative];
 var entry={signature:job.signature,imageSignature:this.data.manifest.imageSignature,renderSignature:this.data.manifest.renderSignature,status:result.status,info:result.info||'',owned:!!previous&&previous.owned!==false,ffxOwned:!!previous&&!!previous.ffxOwned};
 if(result.status==='success')try{
  var poster=await this.callbacks.poster(result),destination=path.join(this.data.output,job.video),png=destination.replace(/\.mp4$/i,'.png');
  if(fs.existsSync(destination)&&previous&&previous.owned===false)throw Error('输出位置出现其他同名视频，未覆盖。');
  mkdir(path.dirname(destination));fs.copyFileSync(result.file,destination);fs.writeFileSync(png,poster);entry.owned=true;
  entry.status='success';entry.duration=result.duration;entry.width=result.width;entry.height=result.height;this.data.manifest.portrait=result.height>result.width;
 }catch(error){entry.status='failed';entry.info=error.message||String(error);result.status='failed';result.info=entry.info;}
 this.data.manifest.jobs[job.relative]=entry;this.results.push(result);this.save();
 await this.callbacks.library(this.data.output,false);self.emit({status:'running',current:result.name});
};
Run.prototype.poll=async function(){
 if(this.closed||this.polling)return;this.polling=true;
 try{
  var progress=readJson(path.join(this.data.runDir,'progress.json'),null),results=readJson(path.join(this.data.runDir,'results.json'),[]);
  for(var i=0;i<results.length;i++)await this.publish(results[i]);
  if(progress&&progress.status!=='running'){
   var known=this.processed,self=this;
   this.data.config.jobs.forEach(function(job){if(!known[job.id]){var entry=self.data.manifest.jobs[job.relative];entry.status='failed';entry.info=progress.status==='cancelled'?'已停止，可再次开始补齐。':progress.error||'AE 任务已中断，可再次开始。';}});
   this.data.manifest.activeRun=null;this.save();await this.callbacks.library(this.data.output,false);this.closed=true;clearInterval(this.timer);this.emit(progress);return;
  }
  this.emit(progress);
 }catch(error){this.closed=true;clearInterval(this.timer);try{fs.writeFileSync(path.join(this.data.runDir,'STOP'),'');}catch(ignore){}this.callbacks.error(error);}
 finally{this.polling=false;}
};
Run.prototype.start=function(){var self=this;this.emit({status:'running'});this.timer=setInterval(function(){self.poll();},700);this.poll();return this;};
Run.prototype.stop=function(){fs.writeFileSync(path.join(this.data.runDir,'STOP'),'');this.emit({status:'running',current:'正在停止：当前预设结束后停止'});};
Run.prototype.abort=function(error){
 this.closed=true;clearInterval(this.timer);
 try{fs.writeFileSync(path.join(this.data.runDir,'STOP'),'');for(var i=0;i<this.data.config.jobs.length;i++){var job=this.data.config.jobs[i];if(!this.processed[job.id]){this.data.manifest.jobs[job.relative].status='failed';this.data.manifest.jobs[job.relative].info=error.message||String(error);}}this.data.manifest.activeRun=null;this.save();this.callbacks.library(this.data.output,false);}catch(ignore){}
 this.callbacks.error(error);
};
function resume(output){var manifest=readJson(path.join(output,'.yuehai-preview.json'),null);if(!manifest||!manifest.activeRun)return null;var data=readJson(path.join(manifest.activeRun,'run.json'),null);if(!data)return null;data.manifest=manifest;return data;}
var workers={};
function launchWorkers(prepared,executable,engine,spawn){
 if(workers[prepared.runId])return workers[prepared.runId];
 spawn=spawn||require('child_process').spawn;
 var aggregate=path.join(prepared.runDir,'results.json'),progressFile=path.join(prepared.runDir,'progress.json');
 function progress(status,current){fs.writeFileSync(progressFile,JSON.stringify({status:status,current:current||''}));}
 function alive(pid){try{process.kill(pid,0);return true;}catch(e){return false;}}
 var task=(async function(){
  var results=readJson(aggregate,[]);
  for(var i=0;i<prepared.config.jobs.length;i++){
   var job=prepared.config.jobs[i];
   if(results.some(function(r){return r.id===job.id;}))continue;
   if(fs.existsSync(path.join(prepared.runDir,'STOP'))){progress('cancelled');return;}
   var dir=path.join(prepared.runDir,'worker-'+job.id),stateFile=path.join(dir,'worker.json');mkdir(dir);
   var existing=readJson(stateFile,null),child=null;
   progress('running','正在启动独立 AE：'+job.name);
   if(!existing||!alive(existing.pid)){
    if(!fs.existsSync(path.join(dir,'results.json'))){
     var config=Object.assign({},prepared.config,{runDir:slash(dir),jobs:[job],total:1});
     var configFile=path.join(dir,'config.jsx'),driver=path.join(require('os').tmpdir(),'yuehai-preview-'+prepared.runId+'-'+job.id+'.jsx');
     fs.writeFileSync(configFile,'\uFEFFvar YUEHAI_PREVIEW_CONFIG='+JSON.stringify(config)+';');
     fs.writeFileSync(driver,'\uFEFF(function(){app.saveProjectOnCrash=false;try{if(app.project.numItems!==0)throw Error("预览渲染需要独立空白进程");$.evalFile(new File('+JSON.stringify(slash(engine))+'));$.evalFile(new File('+JSON.stringify(slash(configFile))+'));YueHaiPreviewEngine.start(YUEHAI_PREVIEW_CONFIG);}catch(e){var f=new File('+JSON.stringify(slash(path.join(dir,'fatal.txt')))+');f.encoding="UTF-8";f.open("w");f.write(e.toString());f.close();}var done=new File('+JSON.stringify(slash(path.join(dir,'finished')))+');done.open("w");done.write("done");done.close();}());');
     try{child=spawn(executable,['-m','-r',driver],{cwd:path.dirname(executable),windowsHide:true,stdio:'ignore',env:Object.assign({},process.env,{YUEHAI_PREVIEW_WORKER:'1'})});}
     catch(e){results.push({id:job.id,name:job.name,status:'failed',info:'无法启动 AE：'+e.message});fs.writeFileSync(aggregate,JSON.stringify(results));continue;}
     var spawnError=null;child.on('error',function(e){spawnError=e;});
     existing={pid:child.pid,jobId:job.id};fs.writeFileSync(stateFile,JSON.stringify(existing));
     child.on('exit',function(code,signal){fs.writeFileSync(path.join(dir,'exit.json'),JSON.stringify({code:code,signal:signal}));});
    }
   }
   if(existing&&existing.pid){
    await new Promise(function(resolve){var timer=setInterval(function(){
     if(fs.existsSync(path.join(prepared.runDir,'STOP')))fs.writeFileSync(path.join(dir,'STOP'),'');
     var nativeProgress=readJson(path.join(dir,'progress.json'),null);
     if(nativeProgress)progress('running',nativeProgress.current||job.name);
     if(fs.existsSync(path.join(dir,'finished'))&&alive(existing.pid)){try{if(child)child.kill();else process.kill(existing.pid);}catch(ignore){}}
     if(!alive(existing.pid)){clearInterval(timer);resolve();}
    },700);});
   }
   var rows=readJson(path.join(dir,'results.json'),[]),result=rows.filter(function(r){return r.id===job.id;})[0];
   if(!result){var fatal=fs.existsSync(path.join(dir,'fatal.txt'))?fs.readFileSync(path.join(dir,'fatal.txt'),'utf8'):'';result={id:job.id,name:job.name,status:'failed',info:fatal||'AE 渲染进程异常退出，已跳过此预设并继续。'};}
   results.push(result);fs.writeFileSync(aggregate,JSON.stringify(results));
  }
  progress(fs.existsSync(path.join(prepared.runDir,'STOP'))?'cancelled':'done');
 })();
 workers[prepared.runId]=task;task.then(function(){delete workers[prepared.runId];},function(){delete workers[prepared.runId];});return task;
}
module.exports={scanPresets:scanPresets,jobAction:jobAction,prepare:prepare,Run:Run,resume:resume,launchWorkers:launchWorkers,defaults:defaults,defaultOutput:defaultOutput};
