'use strict';
var fs=require('fs'),path=require('path'),cp=require('child_process'),previews={};
function settings(){return JSON.parse(fs.readFileSync(path.join(__dirname,'../subtitle-settings.json'),'utf8').replace(/^\uFEFF/,''));}
function task(){var s=settings(),root=s.workspaceRoot||path.resolve(__dirname,'../..'),directory=path.join(root,'套模板',Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));fs.mkdirSync(directory,{recursive:true});return{root:root,directory:directory};}
function payload(config){var job=task(),file=path.join(job.directory,'apply.jsx');fs.writeFileSync(file,'\uFEFFvar YUEHAI_TEMPLATE_CONFIG='+JSON.stringify(config).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';');return file;}
function preview(file,onProgress){var stat=fs.statSync(file),key=path.resolve(file)+'|'+stat.size+'|'+stat.mtimeMs;if(previews[key])return previews[key];
 var job=task(),s=settings(),python=path.join(job.root,s.python||'runtime/subtitles/python/python.exe'),output=path.join(job.directory,'preview.mp4');
 previews[key]=new Promise(function(resolve,reject){
  if(!fs.existsSync(python)){reject(Error('此视频格式需要本地预览环境，请先安装助手的本地字幕运行环境。'));return;}
  var log=fs.openSync(path.join(job.directory,'preview.log'),'a'),child=cp.spawn(python,['-u',path.join(__dirname,'../python/template_proxy.py'),file,output],{windowsHide:true,stdio:['ignore','pipe',log],env:Object.assign({},process.env,{PYTHONIOENCODING:'utf-8'})});fs.closeSync(log);
  child.stdout.on('data',function(chunk){if(onProgress)onProgress(String(chunk).trim());});child.on('error',reject);child.on('close',function(code){if(!code&&fs.existsSync(output))resolve(output);else reject(Error('兼容预览生成失败，请查看 '+path.join(job.directory,'preview.log')));});
 });previews[key].catch(function(){delete previews[key];});return previews[key];
}
module.exports={payload:payload,preview:preview};
