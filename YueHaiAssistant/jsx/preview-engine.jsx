(function(global){
 if(global.YueHaiPreviewEngine&&global.YueHaiPreviewEngine.busy)return;
 var state=null,api={busy:false,runId:null};
 function quote(s){return '"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t')+'"';}
 function json(v){if(v===null||v===undefined)return 'null';if(typeof v==='string')return quote(v);if(typeof v==='number')return isFinite(v)?String(v):'null';if(typeof v==='boolean')return String(v);var a=[],k;if(v instanceof Array){for(k=0;k<v.length;k++)a.push(json(v[k]));return '['+a.join(',')+']';}for(k in v)if(v.hasOwnProperty(k))a.push(quote(k)+':'+json(v[k]));return '{'+a.join(',')+'}';}
 function write(file,value){var f=new File(file);f.encoding='UTF-8';if(!f.open('w'))throw Error('AE 无法写入 '+file+'，请检查文件夹权限和 AE 的“允许脚本写入文件”设置。');f.write(json(value));f.close();}
 function progress(status,current,error){write(state.config.runDir+'/progress.json',{runId:api.runId,status:status,current:current||'',completed:state.results.length,total:state.config.jobs.length,error:error||''});}
 function walk(group,fn){for(var i=1;i<=group.numProperties;i++){var p=group.property(i);if(p.propertyType===PropertyType.PROPERTY)fn(p);else walk(p,fn);}}
 function keyRange(layer){var r={min:100000,max:0,expressions:0};walk(layer,function(p){if(p.numKeys){r.min=Math.min(r.min,p.keyTime(1));r.max=Math.max(r.max,p.keyTime(p.numKeys));}if(p.canSetExpression&&p.expressionEnabled)r.expressions++;});return r;}
 function validate(layer,duration){var errors=[];walk(layer,function(p){
  if(!p.canSetExpression||(!p.expressionEnabled&&!p.expressionError))return;
  var before=p.expression,after=before.replace(/(effect\("Gamma (?:down|up)"\))\("Gamma"\)/g,'$1("ADBE Pro Levels2-0006")');
  after=after.replace(/effect\((['"])(.*?)\1\)\((['"])(Slider|Color|Wiggle Speed \(wigs\/sec\)|Wiggle Amount \((?:pixels|degrees)\))\3\)/g,function(full,q,name,q2,label){
   try{var e=layer.property('ADBE Effect Parade').property(name),index=label.indexOf('Wiggle Amount')===0?2:1;
    if(e&&((label==='Slider'&&e.matchName==='ADBE Slider Control')||(label==='Color'&&e.matchName==='ADBE Color Control')||(/^Wiggle/.test(label)&&/^ADBE CM Wiggle/.test(e.matchName))))return 'effect('+quote(name)+')('+quote(e.property(index).matchName)+')';
   }catch(ignore){}return full;
  });
  if(after!==before){p.expression=after;p.expressionEnabled=true;}
  for(var t=0;t<3;t++){try{p.valueAtTime(t===0?0:t===1?duration/2:duration-1/24,false);}catch(ignore){}if(p.expressionError){errors.push(p.name+': '+p.expressionError);break;}}
 });if(errors.length)throw Error('预设表达式不可用：'+errors.join(' | '));}
 function centerMotion(layer,width,height){var p=layer.property('ADBE Transform Group').property('ADBE Position'),dims=[width,height],offset=[0,0];if(!p)return;var separated=p.dimensionsSeparated;
  for(var axis=0;axis<2;axis++){var prop=separated?p.getSeparationFollower(axis):p,values=[],near=false;
   if(prop.numKeys)for(var k=1;k<=prop.numKeys;k++){var v=prop.keyValue(k);values.push(separated?v:v[axis]);}else{var v=prop.valueAtTime(0,true);values.push(separated?v:v[axis]);}
   var low=values[0],high=values[0];for(var a=0;a<values.length;a++){near=near||Math.abs(values[a]-dims[axis]/2)<dims[axis]*.12;low=Math.min(low,values[a]);high=Math.max(high,values[a]);}
   if(!near&&Math.abs(values[values.length-1])<dims[axis]*.25)offset[axis]=dims[axis]/2;
   if((high<-dims[axis]/2||low>dims[axis]*1.5)&&high-low<dims[axis]/2)offset[axis]=dims[axis]/2-values[values.length-1];
  }
  for(var axis=0;axis<2;axis++)if(separated&&offset[axis]){var prop=p.getSeparationFollower(axis);if(prop.numKeys)for(var k=1;k<=prop.numKeys;k++)prop.setValueAtKey(k,prop.keyValue(k)+offset[axis]);else prop.setValue(prop.valueAtTime(0,true)+offset[axis]);}
  if(!separated&&(offset[0]||offset[1])){if(p.numKeys)for(var k=1;k<=p.numKeys;k++){var v=p.keyValue(k);v[0]+=offset[0];v[1]+=offset[1];p.setValueAtKey(k,v);}else{var v=p.valueAtTime(0,true);v[0]+=offset[0];v[1]+=offset[1];p.setValue(v);}}
 }
 function textContent(layer){var p=layer.property('ADBE Text Properties').property('ADBE Text Document');
  if(p.numKeys)for(var k=1;k<=p.numKeys;k++){var d=p.keyValue(k);d.text=state.config.text;d.fontSize=state.width*.2;p.setValueAtKey(k,d);}else{var d=p.value;d.text=state.config.text;d.fontSize=state.width*.2;p.setValue(d);}
  try{var anchor=layer.property('ADBE Transform Group').property('ADBE Anchor Point'),rect=layer.sourceRectAtTime(0,false);if(anchor&&!anchor.numKeys&&!anchor.expressionEnabled&&rect)anchor.setValue([rect.left+rect.width/2,rect.top+rect.height/2]);}catch(ignore){}
 }
 function ids(){var result={};for(var i=1;i<=app.project.numItems;i++)result[app.project.item(i).id]=true;return result;}
 function collect(before){var result=[];for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(!before[item.id])result.push(item);}return result;}
 function remove(items){for(var i=items.length-1;i>=0;i--)try{if(!(items[i] instanceof FolderItem))items[i].remove();}catch(ignore){}for(var round=0;round<items.length;round++)for(var i=items.length-1;i>=0;i--)try{if(items[i] instanceof FolderItem&&items[i].numItems===0)items[i].remove();}catch(ignore){}}
 function renderSettings(rq){var templates=rq.templates,found=null;for(var i=0;i<templates.length;i++)if(/最佳设置|Best Settings/.test(templates[i])){found=templates[i];break;}if(found)rq.applyTemplate(found);}
 function renderVideo(comp,file,duration){var rq=app.project.renderQueue.items.add(comp);state.activeQueue=rq;renderSettings(rq);rq.timeSpanStart=0;rq.timeSpanDuration=duration;
  var om=rq.outputModule(1),templates=om.templates,found=null;for(var i=0;i<templates.length;i++)if(/H\.264/.test(templates[i])&&/5 Mbps/.test(templates[i])){found=templates[i];break;}if(!found)for(var i=0;i<templates.length;i++)if(/H\.264/.test(templates[i])){found=templates[i];break;}
  if(!found)throw Error('当前 AE 没有 H.264 导出模板，请使用支持原生 H.264 导出的 AE 版本。');
  om.applyTemplate(found);om.file=new File(file);app.project.renderQueue.render();
  if(rq.status!==RQItemStatus.DONE){if(rq.status===RQItemStatus.USER_STOPPED)state.cancelled=true;throw Error('AE 渲染未完成或已停止。');}rq.remove();state.activeQueue=null;
 }
 function particleReference(comp,target,effect,job,duration){
  var file=job.nativeFile.replace(/\.mp4$/i,'-reference.mp4'),reference=comp.duplicate();
  reference.name='YueHai_Particle_Reference';
  try{reference.layer(target.index).property('ADBE Effect Parade').property(effect.propertyIndex).enabled=false;renderVideo(reference,file,duration);}finally{reference.remove();}
  return file;
 }
 function finish(status,error){
  try{remove(state.persistent);if(state.originalActive&&state.originalActive instanceof CompItem){state.originalActive.openInViewer();state.originalActive.time=state.originalTime;for(var i=0;i<state.originalLayers.length;i++)try{state.originalLayers[i].selected=true;}catch(ignore){}}}catch(ignore){}
  api.busy=false;state.lastStatus=status;try{progress(status,'',error);}catch(ignore){}
 }
 api.start=function(config){if(api.busy)return json({ok:false,error:'AE 已经有一个 YueHai 预览任务正在运行。'});
  api.busy=true;api.runId=config.runId;state={config:config,index:0,results:[],persistent:[],originalActive:app.project.activeItem,originalTime:0,originalLayers:[],cancelled:false,activeQueue:null};
  var before=ids();
  try{
   progress('running','正在导入图片');
   if(state.originalActive instanceof CompItem){state.originalTime=state.originalActive.time;state.originalLayers=state.originalActive.selectedLayers;}
   state.folder=app.project.items.addFolder('YueHai_AutoPreview_'+config.runId);
   var importOptions=new ImportOptions(new File(config.image));importOptions.sequence=false;
   state.image=app.project.importFile(importOptions);state.image.parentFolder=state.folder;
   var scale=Math.min(1,1344/Math.max(state.image.width,state.image.height));
   state.width=Math.max(16,Math.round(state.image.width*scale/2)*2);state.height=Math.max(16,Math.round(state.image.height*scale/2)*2);
   state.base=app.project.items.addComp('YueHai_Preview_Photo',state.width,state.height,1,60,24);state.base.parentFolder=state.folder;
   var photo=state.base.layers.add(state.image),fit=Math.min(state.width/state.image.width,state.height/state.image.height)*100;photo.property('ADBE Transform Group').property('ADBE Scale').setValue([fit,fit]);
   state.available={};var installed=app.effects;for(var e=0;e<installed.length;e++)state.available[installed[e].matchName]=true;
   state.persistent=collect(before);write(config.runDir+'/results.json',[]);
   while(api.busy)api.step();
   return json({ok:state.lastStatus!=='failed',runId:api.runId});
  }catch(e){state.persistent=collect(before);finish('failed',e.toString());return json({ok:false,error:e.toString()});}
 };
 api.step=function(){
  if(!api.busy)return;
  if(state.cancelled||new File(state.config.runDir+'/STOP').exists){finish('cancelled');return;}
  if(state.index>=state.config.jobs.length){finish('done');return;}
  var job=state.config.jobs[state.index++],before=ids(),owned=[],disabled=[],previousGpu=app.project.gpuAccelType,result={id:job.id,name:job.name,relative:job.relative,status:'failed',info:''};
  try{
   progress('running','正在渲染 '+job.name);app.beginUndoGroup('YueHai 自动预览');app.beginSuppressDialogs();
   if(app.project.renderQueue.rendering)throw Error('AE 正在进行其他渲染，请稍后重试。');
   for(var q=1;q<=app.project.renderQueue.numItems;q++){var old=app.project.renderQueue.item(q);if(old.status===RQItemStatus.QUEUED&&old.render){disabled.push(old);old.render=false;}}
   app.project.gpuAccelType=GpuAccelType.SOFTWARE;
   var comp=app.project.items.addComp('YueHai_Preview_'+job.id,state.width,state.height,1,60,24);comp.parentFolder=state.folder;
   var work=comp,target;
   if(job.kind==='text'){
    var bg=comp.layers.addSolid([.045,.055,.075],'YueHai_Text_Background',state.width,state.height,1);bg.selected=false;
    target=comp.layers.addText(state.config.text);var td=target.property('ADBE Text Properties').property('ADBE Text Document').value;td.fontSize=state.width*.2;td.fillColor=[1,1,1];td.applyFill=true;td.justification=ParagraphJustification.CENTER_JUSTIFY;target.property('ADBE Text Properties').property('ADBE Text Document').setValue(td);textContent(target);target.property('ADBE Transform Group').property('ADBE Position').setValue([state.width/2,state.height/2]);
   }else if(job.kind==='particle'){target=comp.layers.addSolid([0,0,0],'YueHai_Particle',state.width,state.height,1);}
   else if(job.kind==='shape'){target=comp.layers.addShape();}
   else if(job.kind==='color'){
    work=app.project.items.addComp('YueHai_Color_Work',Math.ceil(Math.max(1280,state.width+192)/64)*64,Math.ceil(Math.max(1600,state.height+256)/64)*64,1,60,24);work.parentFolder=state.folder;
    var image=work.layers.add(state.base);image.selected=false;target=work.layers.addSolid([1,1,1],'YueHai_Color_Adjustment',work.width,work.height,1);target.adjustmentLayer=true;comp.layers.add(work).selected=false;
   }else target=comp.layers.add(state.base);
   work.openInViewer();work.time=0;for(var l=1;l<=work.numLayers;l++)work.layer(l).selected=false;target.selected=true;target.applyPreset(new File(job.source));
   owned=collect(before);
   if(job.kind==='text')textContent(target);if(job.kind==='motion')centerMotion(target,state.width,state.height);
   var effectGroup=target.property('ADBE Effect Parade'),particular=null,temporal=false;
   for(var e=1;e<=effectGroup.numProperties;e++){var effect=effectGroup.property(e),match=effect.matchName;
    if(!state.available[match]&&!/^Pseudo\//.test(match)){var available=app.effects;for(var a=0;a<available.length;a++)state.available[available[a].matchName]=true;if(!state.available[match])throw Error('缺少预设所需插件：'+match);}
    if(match==='tc Particular')particular=effect;if(/^Twixtor/.test(match))temporal=true;
   }
   if(temporal){var moving=state.base.duplicate();moving.parentFolder=state.folder;var transform=moving.layer(1).property('ADBE Transform Group'),s=transform.property('ADBE Scale').value;transform.property('ADBE Scale').setValue([s[0]*1.16,s[1]*1.16]);for(var t=0;t<=60;t+=2)transform.property('ADBE Position').setValueAtTime(t,[state.width/2+(t%4===0?-1:1)*state.width*.045,state.height/2]);target.replaceSource(moving,false);owned.push(moving);}
   var keys=keyRange(target);if(keys.min<0){target.startTime-=keys.min;keys=keyRange(target);}
   var duration=Math.ceil(Math.max(state.config.minimumDuration,keys.max+.5,keys.expressions?4:0,particular?8:0)*24)/24;
   if(duration>10800)throw Error('关键帧时长超过 AE 合成限制。');comp.duration=duration;work.duration=duration;state.base.duration=Math.max(60,duration);state.base.layer(1).outPoint=state.base.duration;
   for(var l=1;l<=work.numLayers;l++)work.layer(l).outPoint=duration;if(work!==comp)comp.layer(1).outPoint=duration;
   validate(target,duration);renderVideo(comp,job.nativeFile,duration);
   result.file=job.nativeFile;result.duration=duration;result.keyMax=keys.max;result.width=state.width;result.height=state.height;
   if(particular)result.reference=particleReference(comp,target,particular,job,duration);
   result.status='success';
  }catch(e){result.info=e.toString();}
  finally{
   try{if(state.activeQueue){state.activeQueue.remove();state.activeQueue=null;}}catch(ignore){}
   if(!owned.length)owned=collect(before);remove(owned);
   for(var q=0;q<disabled.length;q++)try{disabled[q].render=true;}catch(ignore){}
   try{app.project.gpuAccelType=previousGpu;app.endSuppressDialogs(false);app.endUndoGroup();}catch(ignore){}
  }
  state.results.push(result);
  try{write(state.config.runDir+'/results.json',state.results);progress('running',job.name);if(state.index%10===0&&typeof PurgeTarget.IMAGE_CACHES!=='undefined')app.purge(PurgeTarget.IMAGE_CACHES);}catch(e){finish('failed',e.toString());}
 };
 global.YueHaiPreviewEngine=api;
}($.global));
