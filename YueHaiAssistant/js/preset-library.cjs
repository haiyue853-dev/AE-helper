'use strict';
var fs=require('fs'),path=require('path');
var builtinFolders=['Backgrounds','Behaviors','Image - Creative','Image - Special Effects','Image - Utilities','Shapes','Sound Effects','Synthetics','Text','Transform','Transitions - Dissolves','Transitions - Movement','Transitions - Wipes'];
function slash(value){return value.replace(/\\/g,'/');}
function json(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(ignore){return null;}}
function inside(root,file){var relative=path.relative(root,file);return relative!=='..'&&relative.indexOf('..'+path.sep)!==0&&!path.isAbsolute(relative);}
function id(relative){var parts=relative.replace(/\.ffx$/i,'').split('/'),name=parts.pop();return parts.join('/')+'/'+name.toLowerCase();}
function record(file,relative){var stat=fs.statSync(file);return {name:path.basename(file),relativePath:relative,filePath:slash(path.resolve(file)),size:stat.size,modified:stat.mtimeMs};}
function refresh(source,options){
 options=options||{};source=path.resolve(source);var storage=path.resolve(options.storageRoot||require('./preview-generation.cjs').defaults().storageRoot),jobs=[],manifests=[],folders=[];
 if(!fs.statSync(source).isDirectory())throw Error('预设目录不可读取，请重新选择预设目录。');
 function visit(dir,relative){fs.readdirSync(dir).sort().forEach(function(name){
  if(name.charAt(0)==='.'||(!relative&&options.excludeBuiltins!==false&&builtinFolders.indexOf(name)!==-1))return;
  var file=path.join(dir,name),stat=fs.lstatSync(file),rel=(relative?relative+'/':'')+name;
  if(stat.isSymbolicLink())return;
  if(stat.isDirectory()){if(inside(file,storage)||json(path.join(file,'.yuehai-preview.json')))return;folders.push(rel);visit(file,rel);}
  else if(/\.ffx$/i.test(name))jobs.push({relative:rel,record:record(file,rel),signature:slash(file)+'|'+stat.size+'|'+stat.mtimeMs});
 });}
 visit(source,'');
 function outputs(dir){if(!fs.existsSync(dir))return;var file=path.join(dir,'.yuehai-preview.json'),manifest=json(file);
  if(manifest&&manifest.version===1&&manifest.sourceRoot&&manifest.jobs)manifests.push({data:manifest,dir:dir,modified:fs.statSync(file).mtimeMs});
  fs.readdirSync(dir).forEach(function(name){if(name.charAt(0)==='.')return;var child=path.join(dir,name),s=fs.lstatSync(child);if(s.isDirectory()&&!s.isSymbolicLink())outputs(child);});
 }
 outputs(storage);(options.generatedPaths||[]).forEach(function(dir){if(!inside(storage,path.resolve(dir)))outputs(path.resolve(dir));});
 manifests.sort(function(a,b){return a.modified-b.modified;});
 var matches={};manifests.forEach(function(m){Object.keys(m.data.jobs).forEach(function(relative){var original=path.resolve(m.data.sourceRoot,relative);if(!inside(source,original))return;matches[slash(path.relative(source,original)).toLowerCase()]={manifest:m,entry:m.data.jobs[relative],relative:relative};});});
 var result={id:'yuehai-my-presets',name:'我的预设',builtin:true,live:true,sourceRoot:slash(source),records:[],folders:folders,previewStates:{},failures:{},pending:{},notes:{},layouts:{}};
 jobs.forEach(function(job){var key=id(job.relative),match=matches[job.relative.toLowerCase()],entry=match&&match.entry,state='missing',media=[];
  result.records.push(job.record);
  if(entry&&entry.signature===job.signature){
   if(entry.status==='failed'){state='failed';result.failures[key]=entry.info||'上次生成未完成，可重试。';}
   else if(entry.status==='pending'){state='pending';result.pending[key]='正在制作预览…';}
   else if(entry.status==='success'){
    ['png','mp4'].forEach(function(ext){var relative=match.relative.replace(/\.ffx$/i,'.'+ext),file=path.join(match.manifest.dir,relative);if(inside(match.manifest.dir,file)&&fs.existsSync(file))media.push(record(file,job.relative.replace(/\.ffx$/i,'.'+ext)));});
    if(media.length)state='ready';
   }
  }else if(entry)result.notes[key]='预设已修改，请重新生成预览。';
  // A same-name preview supplied beside the original preset is also usable.
  if(!entry)['png','jpg','jpeg','mp4','webm'].forEach(function(ext){var relative=job.relative.replace(/\.ffx$/i,'.'+ext),file=path.join(source,relative);if(fs.existsSync(file))media.push(record(file,relative));});
  if(media.length){state='ready';result.records=result.records.concat(media);}
  result.previewStates[key]=state;result.layouts[key]={portrait:match?match.manifest.data.portrait!==false:true,imageOnly:/调色|温向竹cc/i.test(job.relative)||(media.length>0&&!media.some(function(r){return /\.(mp4|webm)$/i.test(r.name);}))};
 });
 result.description=jobs.length+' 个本地预设 · 目录已刷新';
 fs.mkdirSync(storage,{recursive:true});var target=path.join(storage,'.yuehai-library.json');fs.writeFileSync(target+'.tmp',JSON.stringify(result));fs.renameSync(target+'.tmp',target);
 return result;
}
module.exports={refresh:refresh,builtinFolders:builtinFolders};
