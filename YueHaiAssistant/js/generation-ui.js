(function(){
 'use strict';
 var host=window.YueHaiHost,els={},run=null,running=false,presetBase='',outputCustom=false,remembered={},selection=null;
 try{remembered=JSON.parse(localStorage.getItem('yuehai.generator.v1')||'{}');}catch(ignore){}
 document.addEventListener('DOMContentLoaded',init);
 function init(){
  if(host.isPreviewWorker)return;
  if(remembered.storageVersion!==2){remembered.outputRoot='';remembered.customOutput=false;}
  outputCustom=!!remembered.customOutput;
  ['generationSelection','generatePreviews','generationOverlay','closeGeneration','generationImage','generationPresets','generationOutput','generationText','generationDuration','generationReuse','generationProgress','generationStatus','generationResults','generationHostNote','startGeneration','stopGeneration'].forEach(function(id){els[id]=document.getElementById(id);});
  els.generatePreviews.addEventListener('click',open);els.closeGeneration.addEventListener('click',close);
  document.addEventListener('yuehai:request-preview',function(event){open(event.detail);});
  els.generationOverlay.addEventListener('click',function(e){if(e.target===els.generationOverlay)close();});
  document.addEventListener('keydown',function(e){if(!els.generationOverlay.hidden&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}},true);
  els.generationImage.value=remembered.image||(host.isCep?host.defaultPreviewImage():'');els.generationPresets.value=remembered.presetRoot||'';els.generationOutput.value=remembered.outputRoot||'';
  els.generationText.value=remembered.text||'adc';els.generationDuration.value=remembered.minimumDuration||4;
  els.generationHostNote.hidden=host.isCep;
  Array.prototype.forEach.call(document.querySelectorAll('[data-generation-pick]'),function(button){button.disabled=!host.isCep;button.addEventListener('click',function(){pick(button.getAttribute('data-generation-pick'));});});
  els.startGeneration.disabled=!host.isCep;
  els.startGeneration.addEventListener('click',start);els.stopGeneration.addEventListener('click',function(){if(run){run.stop();els.stopGeneration.disabled=true;}});
  if(host.isCep){
   host.defaultPresetRoot().then(function(path){presetBase=path.replace(/\\/g,'/');if(!els.generationPresets.value)els.generationPresets.value=presetBase;updateOutput();},function(){});
   if(remembered.outputRoot)host.resumeGeneration(remembered.outputRoot,callbacks()).then(function(restored){if(restored){run=restored;setRunning(true);}},error);
  }
 }
 function open(request){
  var context={};document.dispatchEvent(new CustomEvent('yuehai:preview-context',{detail:context}));
  if(!running){
   selection=request&&request.relativePaths?request:null;
   els.generationSelection.hidden=!selection;
   if(selection){els.generationPresets.value=selection.sourceRoot||presetBase;outputCustom=false;updateOutput();els.generationSelection.textContent=({single:'单个重做',missing:'补齐缺失',failed:'重试失败'}[selection.kind]||'指定预设')+' · '+selection.relativePaths.length+' 个预设'+(selection.relativePaths.length===1?' · '+selection.relativePaths[0]:'');els.generationReuse.checked=false;}
   else if(host.isCep&&presetBase&&context.folder&&!remembered.presetRoot){els.generationPresets.value=presetBase+'/'+context.folder;outputCustom=false;updateOutput();}
   els.generationReuse.disabled=!!selection;
  }
  els.generationOverlay.hidden=false;els.closeGeneration.focus();
 }
 function close(){els.generationOverlay.hidden=true;els.generatePreviews.focus();}
 function error(e){setRunning(false);els.generationStatus.textContent=e.message||String(e);els.generationStatus.classList.add('generation-error');}
 function updateOutput(){if(host.isCep&&!outputCustom&&els.generationPresets.value)els.generationOutput.value=host.defaultPreviewOutput(els.generationPresets.value,presetBase);}
 function pick(kind){
  host.choosePreviewPath(kind,kind==='output'?els.generationOutput.value:els.generationPresets.value).then(function(path){
   if(!path)return;
   if(kind==='image')els.generationImage.value=path;
   else if(kind==='presets'){selection=null;els.generationSelection.hidden=true;els.generationReuse.disabled=false;els.generationPresets.value=path;updateOutput();}
   else{els.generationOutput.value=path;outputCustom=true;}
  },error);
 }
 function setRunning(value){
  running=value;els.startGeneration.disabled=value||!host.isCep;els.stopGeneration.hidden=!value;els.stopGeneration.disabled=false;
  Array.prototype.forEach.call(document.querySelectorAll('.generation-fields input,.generation-fields button'),function(input){input.disabled=value||(!host.isCep&&input.tagName==='BUTTON');});
  els.generationReuse.disabled=value||!!selection;
  if(!value)els.generatePreviews.textContent='生成预览';
 }
 function callbacks(){return {
  library:function(library,activate){document.dispatchEvent(new CustomEvent('yuehai:preview-library',{detail:{library:library,activate:activate&&!selection}}));},
  error:error,
  progress:function(p){
   els.generationProgress.max=p.total||1;els.generationProgress.value=p.completed;
   var finished=p.status!=='running';
   els.generationStatus.classList.remove('generation-error');
   els.generationStatus.textContent=(finished?(p.status==='cancelled'?'已停止':p.status==='failed'?'任务中断':'处理结束'):'生成中 '+p.completed+'/'+p.total)+' · '+p.success+' 个完成 · '+p.failed+' 个失败'+(finished&&p.remaining?' · '+p.remaining+' 个未完成':'')+(!finished&&p.current?'\n'+p.current:'')+(p.error?'\n'+p.error:'');
   els.generatePreviews.textContent=finished?'生成预览':'生成中 '+p.completed+'/'+p.total;
   els.generationResults.textContent='';
   p.results.slice().reverse().forEach(function(result){var li=document.createElement('li');li.className=result.status==='success'?'generation-success':'generation-error';li.textContent=(result.status==='success'?(result.cached?'已复用 · ':'完成 · '):'失败 · ')+result.name+(result.info?'：'+result.info:'');els.generationResults.appendChild(li);});
   if(finished)setRunning(false);
  }
 };}
 function start(){
  if(running)return;
  if(!els.generationImage.value||!els.generationPresets.value){error(new Error('请先选择图片和 FFX 预设文件夹。'));return;}
  var root=els.generationPresets.value.replace(/[\\/]$/,''),options={image:els.generationImage.value,presetRoot:root,outputRoot:els.generationOutput.value||host.defaultPreviewOutput(root,presetBase),text:els.generationText.value||'adc',minimumDuration:Number(els.generationDuration.value)||4,reuse:els.generationReuse.checked,presetBase:presetBase,storageVersion:2,customOutput:outputCustom};
  if(selection){options.relativePaths=selection.relativePaths.slice();options.reuse=false;}
  remembered=options;try{localStorage.setItem('yuehai.generator.v1',JSON.stringify(options));}catch(ignore){}
  run=null;els.generationOutput.value=options.outputRoot;els.generationResults.textContent='';els.generationStatus.textContent='正在扫描预设并启动 AE 渲染…';els.generationStatus.classList.remove('generation-error');setRunning(true);els.stopGeneration.disabled=true;
  try{host.startGeneration(options,callbacks()).then(function(active){run=active;if(running)els.stopGeneration.disabled=false;},error);}catch(e){error(e);}
 }
 window.YueHaiPreviewUI={open:open};
}());
