(function(global){
 function quote(s){return '"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n')+'"';}
 function selection(){
  var comp=app.project.activeItem;if(!(comp instanceof CompItem))throw Error('请先打开合成，并选中一个视频或音频图层。');
  var layers=comp.selectedLayers;if(layers.length!==1)throw Error('请只选中一个要识别的视频或音频图层。');
  var layer=layers[0];if(!(layer instanceof AVLayer))throw Error('请选择带音频的视频或音频图层。');
  if(layer.timeRemapEnabled)throw Error('这个图层启用了时间重映射，请先预渲染为带音频的视频，再识别。');
  if(layer.stretch<=0)throw Error('倒放图层请先预渲染为带音频的视频，再识别。');
  if(!(layer.source instanceof FootageItem)||!layer.source.file)throw Error('预合成或合成素材请先预渲染为带音频的视频，再识别。');
  if(!layer.hasAudio)throw Error('选中的图层没有音轨，请选择带人声的视频或音频图层。');
  if(!layer.source.file.exists)throw Error('图层的源文件已丢失，请先在 AE 中重新链接素材。');
  var ratio=layer.stretch/100,first=Math.max(0,layer.inPoint,layer.startTime),last=Math.min(comp.duration,layer.outPoint,layer.startTime+layer.source.duration*ratio);
  if(last<=first)throw Error('图层在合成中没有可识别的有效范围。');
  return{comp:comp,layer:layer,offset:first,sourceIn:(first-layer.startTime)/ratio,sourceOut:(last-layer.startTime)/ratio};
 }
 function sourceJson(value){var layer=value.layer,comp=value.comp;return '{"compId":'+comp.id+',"layerId":'+(layer.id||0)+',"layerIndex":'+layer.index+',"layerName":'+quote(layer.name)+',"compName":'+quote(comp.name)+',"video":'+quote(layer.source.file.fsName)+',"offset":'+value.offset+',"sourceIn":'+value.sourceIn+',"sourceOut":'+value.sourceOut+',"stretch":'+layer.stretch+',"inPoint":'+layer.inPoint+',"outPoint":'+layer.outPoint+',"startTime":'+layer.startTime+'}';}
 global.YueHaiSubtitles={readSelection:function(){try{return '{"ok":true,"sourceLayer":'+sourceJson(selection())+'}';}catch(e){return '{"ok":false,"error":'+quote(e.toString())+'}';}},importCues:function(config){
  var created=[],owned=[],comp=null,newComp=false,group=false;
  try{
   var cues=config.cues;if(!cues||!cues.length)throw Error('没有可导入的字幕。');
   var previous=0;for(var c=0;c<cues.length;c++){if(cues[c].start<0||cues[c].end<=cues[c].start||(c&&cues[c].start<previous-.0001))throw Error('字幕时间无效或重叠。');previous=cues[c].end;}
   if(config.mode==='layer'){
    var selected=config.sourceLayer;if(!selected)throw Error('这个任务不是从 AE 图层识别的，请重新读取图层。');
    for(var j=1;j<=app.project.numItems;j++){var candidate=app.project.item(j);if(candidate instanceof CompItem&&candidate.id===selected.compId){comp=candidate;break;}}
    if(!comp)throw Error('原图层所在合成已关闭或删除，请重新读取图层。');
    var original=null;for(var j=1;j<=comp.numLayers;j++){var candidate=comp.layer(j);if(selected.layerId?candidate.id===selected.layerId:candidate.index===selected.layerIndex){original=candidate;break;}}
    if(!original||!(original instanceof AVLayer)||!original.source||!original.source.file||original.source.file.fsName!==new File(config.video).fsName||original.timeRemapEnabled||Math.abs(original.startTime-selected.startTime)>.0001||Math.abs(original.inPoint-selected.inPoint)>.0001||Math.abs(original.outPoint-selected.outPoint)>.0001||Math.abs(original.stretch-selected.stretch)>.0001)throw Error('原图层已删除、替换或调整时间，请重新读取并识别，避免字幕错位。');
   }else if(config.mode!=='new'){comp=app.project.activeItem;if(!(comp instanceof CompItem))throw Error('请先打开目标合成，或选择“新建视频合成”。');}
   app.beginUndoGroup('YueHai 本地字幕');group=true;var offset=0;
   if(config.mode==='new'){
    var sourceFile=new File(config.video);if(!sourceFile.exists)throw Error('原视频文件不存在。');
    var footage=null;for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(item instanceof FootageItem&&item.file&&item.file.fsName===sourceFile.fsName){footage=item;break;}}
    if(!footage){var options=new ImportOptions(sourceFile);options.sequence=false;footage=app.project.importFile(options);owned.push(footage);}
    var duration=footage.duration||cues[cues.length-1].end,width=footage.width||1920,height=footage.height||1080,rate=footage.frameRate||25;
    comp=app.project.items.addComp(decodeURI(sourceFile.name).replace(/\.[^.]+$/,'')+'_字幕',width,height,footage.pixelAspect||1,duration,rate);owned.push(comp);newComp=true;comp.layers.add(footage);
   }else offset=config.mode==='layer'?config.sourceLayer.offset:comp.time;
   var size=Math.max(20,Math.min(90,Math.round(comp.height*.045))),count=0;
   for(var i=cues.length-1;i>=0;i--){var cue=cues[i],start=offset+cue.start,end=Math.min(comp.duration,offset+cue.end);if(!String(cue.text).length||start>=comp.duration||end<=start)continue;
    var layer=comp.layers.addText(String(cue.text));created.push(layer);layer.name='字幕 '+(i+1)+' · '+String(cue.text).replace(/[\r\n]/g,' ').slice(0,28);
    var sourceText=layer.property('ADBE Text Properties').property('ADBE Text Document'),document=sourceText.value;document.fontSize=size;document.applyFill=true;document.fillColor=[1,1,1];document.applyStroke=true;document.strokeColor=[0,0,0];document.strokeWidth=Math.max(1,size*.055);document.strokeOverFill=false;document.justification=ParagraphJustification.CENTER_JUSTIFY;sourceText.setValue(document);
    layer.inPoint=start;layer.outPoint=end;var rect=layer.sourceRectAtTime(start,false),transform=layer.property('ADBE Transform Group');transform.property('ADBE Anchor Point').setValue([rect.left+rect.width/2,rect.top+rect.height/2]);transform.property('ADBE Position').setValue([comp.width/2,comp.height*.88]);if(rect.width>comp.width*.9){var fit=comp.width*.9/rect.width*100;transform.property('ADBE Scale').setValue([fit,fit]);}count++;
   }
   if(!count)throw Error('字幕时间超出了当前合成，请移动时间指针或新建视频合成。');
   comp.openInViewer();return '{"ok":true,"count":'+count+',"skipped":'+(cues.length-count)+',"name":'+quote(comp.name)+'}';
  }catch(e){for(var i=created.length-1;i>=0;i--)try{created[i].remove();}catch(ignore){}for(var i=owned.length-1;i>=0;i--)try{owned[i].remove();}catch(ignore){}return '{"ok":false,"error":'+quote(e.toString())+'}';}
  finally{if(group)app.endUndoGroup();}
 }};
}($.global));
