'use strict';
var fs=require('fs'),path=require('path'),cp=require('child_process'),model=require('./subtitle-model.js');
var jobs={};
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch(e){return fallback;}}
function write(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2));}
function paths(){var settings=read(path.join(__dirname,'../subtitle-settings.json'),{}),root=settings.workspaceRoot||path.resolve(__dirname,'../..');return{root:root,output:path.join(root,'字幕'),python:path.join(root,settings.python||'runtime/subtitles/python/python.exe'),model:path.join(root,settings.model||'models/faster-whisper-small'),nativeEngine:path.join(root,settings.nativeEngine||'runtime/subtitles/universal/YueHaiAsr.exe'),models:{accurate:path.join(root,'models/whisper-cpp/ggml-large-v3-q5_0.bin'),fast:path.join(root,'models/whisper-cpp/ggml-small-q5_1.bin')}};}
function status(){var p=paths(),engine=fs.existsSync(p.python)&&fs.existsSync(p.nativeEngine),accurate=engine&&fs.existsSync(p.models.accurate),fast=engine&&fs.existsSync(p.models.fast);return{ready:accurate||fast,accurateReady:accurate,fastReady:fast,output:p.output,model:'Whisper · 本地识别',message:accurate?'影视精度模型已就绪 · 自动显卡 / CPU 兼容':fast?'快速模型已就绪；影视精度模型尚未下载':'本地字幕环境尚未安装，请运行助手目录里的 tools/setup-subtitles.ps1。'};}
function directory(dir){var full=path.resolve(dir),root=path.resolve(paths().output)+path.sep;if(full.toLowerCase().indexOf(root.toLowerCase())!==0)throw Error('任务不在助手的字幕目录内。');return full;}
function load(dir){dir=directory(dir);var config=read(path.join(dir,'job.json'),null);if(!config)throw Error('没有找到这个字幕任务。');return config;}
function create(options){
 var video=path.resolve(options.video||''),stat;try{stat=fs.statSync(video);}catch(e){throw Error('找不到选择的视频文件。');}
 if(!stat.isFile()||!stat.size||! /\.(mp4|mov|mkv|avi|webm|m4v|mxf|mts|wmv|mp3|wav|m4a|aac|flac|ogg)$/i.test(video))throw Error('请选择有效的视频或音频文件。');
 var p=paths(),name=path.basename(video,path.extname(video)),id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),dir=path.join(p.output,name+'-'+id);
 var quality=options.quality==='fast'?'fast':'accurate',device=options.device==='cpu'?'cpu':'auto';
 fs.mkdirSync(dir,{recursive:true});var config={id:id,directory:dir,video:video,model:p.model,nativeEngine:p.nativeEngine,nativeModel:p.models[quality],quality:quality,device:device,language:options.language||'auto',maxChars:Math.max(8,Math.min(60,Number(options.maxChars)||22))};
 if(options.sourceLayer){var layer=options.sourceLayer;if(path.resolve(layer.video)!==video||!isFinite(layer.sourceIn)||!isFinite(layer.sourceOut)||layer.sourceIn<0||layer.sourceOut<=layer.sourceIn||!isFinite(layer.stretch)||layer.stretch<=0||!isFinite(layer.offset)||layer.offset<0)throw Error('AE 图层范围无效，请重新读取图层。');config.sourceLayer=layer;}
 write(path.join(dir,'job.json'),config);write(path.join(dir,'progress.json'),{state:'queued',message:'等待开始识别…',percent:0,count:0});return config;
}
function save(dir,cues){var config=load(dir);model.validate(cues);cues=cues.filter(function(c){return String(c.text||'').trim();}).map(function(c){return{start:Number(c.start),end:Number(c.end),text:String(c.text).trim()};});
 var name=path.basename(config.video,path.extname(config.video)),result={video:config.video,directory:config.directory,cues:cues,srt:path.join(dir,name+'.srt'),text:path.join(dir,name+'.txt')};
 fs.writeFileSync(result.srt,'\uFEFF'+model.toSrt(cues),'utf8');fs.writeFileSync(result.text,cues.map(function(c){return c.text;}).join('\r\n'),'utf8');write(path.join(dir,'subtitle.json'),result);return result;
}
function alive(pid){if(!pid)return false;try{process.kill(pid,0);return true;}catch(e){return false;}}
function Job(config,callbacks){this.config=config;this.callbacks=callbacks||{};this.timer=null;this.closed=false;this.child=null;this.started=Date.now();this.last='';}
Job.prototype.snapshot=function(){
 var dir=this.config.directory,progress=read(path.join(dir,'progress.json'),{state:'running',message:'正在启动本地识别…',percent:0}),raw=read(path.join(dir,'recognition.json'),{segments:[]}),saved=read(path.join(dir,'subtitle.json'),null);
 var terminal=['done','empty','cancelled','failed'].indexOf(progress.state)>=0,cues=saved?saved.cues:model.buildCues(raw.segments,this.config.maxChars);
 return{directory:dir,video:this.config.video,sourceLayer:this.config.sourceLayer||null,state:progress.state,message:progress.message,percent:progress.percent||0,count:cues.length,cues:cues,language:raw.language||this.config.language,duration:raw.duration||0,terminal:terminal,result:saved};
};
Job.prototype.poll=function(){if(this.closed)return;try{
 var dir=this.config.directory,snapshot=this.snapshot(),owner=read(path.join(dir,'process.json'),{});
 if(!snapshot.terminal&&Date.now()-this.started>5000&&owner.pid&&!alive(owner.pid)){write(path.join(dir,'progress.json'),{state:'failed',message:'本地识别进程已退出，请重新开始。',percent:snapshot.percent});snapshot=this.snapshot();}
 if(snapshot.terminal){if(snapshot.cues.length&&!snapshot.result&&(snapshot.state==='done'||snapshot.state==='cancelled'))snapshot.result=save(dir,snapshot.cues);this.closed=true;clearInterval(this.timer);}
 var key=JSON.stringify([snapshot.state,snapshot.message,snapshot.count,snapshot.percent]);if(key!==this.last||snapshot.terminal){this.last=key;if(this.callbacks.update)this.callbacks.update(snapshot);}
 }catch(e){this.closed=true;clearInterval(this.timer);if(this.callbacks.error)this.callbacks.error(e);}};
Job.prototype.watch=function(){var self=this;this.timer=setInterval(function(){self.poll();},500);this.poll();return this;};
Job.prototype.cancel=function(){fs.writeFileSync(path.join(this.config.directory,'STOP'),'');};
Job.prototype.attach=function(callbacks){this.callbacks=callbacks;this.last='';this.poll();return this;};
function start(options,callbacks){var available=status();if(!available.ready)throw Error(available.message);if(!(options.quality==='fast'?available.fastReady:available.accurateReady))throw Error('所选模型尚未安装，请运行 tools/setup-subtitles.ps1。');var config=create(options),p=paths(),job=new Job(config,callbacks);jobs[config.directory]=job;
 write(path.join(config.directory,'progress.json'),{state:'running',message:'正在启动本地语音识别…',percent:0,count:0});
 var child=cp.spawn(p.python,['-u',path.join(__dirname,'../python/transcribe.py'),path.join(config.directory,'job.json')],{cwd:path.dirname(p.python),windowsHide:true,detached:true,stdio:'ignore',env:Object.assign({},process.env,{HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',PYTHONIOENCODING:'utf-8'})});job.child=child;
 write(path.join(config.directory,'process.json'),{pid:child.pid});child.on('error',function(e){write(path.join(config.directory,'progress.json'),{state:'failed',message:'无法启动本地识别：'+e.message,percent:0});});child.unref();return job.watch();
}
function resume(dir,callbacks){var config=load(dir),existing=jobs[config.directory];if(existing&&!existing.closed)return existing.attach(callbacks);var job=new Job(config,callbacks);jobs[config.directory]=job;return job.watch();}
function importConfig(dir,cues,mode){var config=load(dir),result=save(dir,cues);if(!result.cues.length)throw Error('没有可导入的字幕。');if(mode==='layer'&&!config.sourceLayer)throw Error('这个任务不是从 AE 图层识别的。');if((!mode||mode==='new')&&config.sourceLayer)throw Error('图层字幕请选择“原图层所在合成”或“当前合成”，以保留剪辑时间。');var file=path.join(dir,'ae-subtitles.jsx');fs.writeFileSync(file,'\uFEFFvar YUEHAI_SUBTITLES='+JSON.stringify({video:result.video,cues:result.cues,mode:mode||'new',sourceLayer:config.sourceLayer||null}).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';');return file;}
function openFolder(dir){dir=directory(dir);cp.spawn('explorer.exe',[dir],{windowsHide:true,stdio:'ignore'}).unref();}
module.exports={paths:paths,status:status,create:create,load:load,save:save,start:start,resume:resume,importConfig:importConfig,openFolder:openFolder};
