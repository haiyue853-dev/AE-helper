(function(global){
 var MARK='YUEHAI_TEMPLATE_MEDIA_V1';
 function json(value){if(value===null||value===undefined)return 'null';if(typeof value==='string')return '"'+value.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/[\x00-\x1f]/g,function(c){return '\\u'+('000'+c.charCodeAt(0).toString(16)).slice(-4);})+'"';if(typeof value==='number')return isFinite(value)?String(value):'null';if(typeof value==='boolean')return String(value);var list=[],i;if(value instanceof Array){for(i=0;i<value.length;i++)list.push(json(value[i]));return '['+list.join(',')+']';}for(i in value)if(value.hasOwnProperty(i))list.push(json(i)+':'+json(value[i]));return '{'+list.join(',')+'}';}
 function response(fn){try{var value=fn();value.ok=true;return json(value);}catch(e){return json({ok:false,error:e.toString()});}}
 function compById(id){for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(item instanceof CompItem&&item.id===Number(id))return item;}throw Error('合成已不存在，请重新读取工程。');}
 function managed(source){return source instanceof CompItem&&source.comment===MARK;}
 function textProperty(layer){return layer.property('ADBE Text Properties')&&layer.property('ADBE Text Properties').property('ADBE Text Document');}
 function textValues(property){var texts=[];if(property.numKeys){for(var k=1;k<=property.numKeys;k++)texts.push(property.keyValue(k).text);}else texts.push(property.value.text);return texts;}
 function scan(rootId){
  var root=compById(rootId),media=[],texts=[],visited={},occurrences={};
  function walk(comp,route){occurrences[comp.id]=(occurrences[comp.id]||0)+1;if(visited[comp.id])return;visited[comp.id]=true;
   for(var i=1;i<=comp.numLayers;i++){
    var layer=comp.layer(i),key='c'+comp.id+'l'+(layer.id||i),property=textProperty(layer);
    if(property){var values=textValues(property);texts.push({key:key,compId:comp.id,layerId:layer.id||0,index:i,name:layer.name,path:route.join(' / '),text:values[0],keyframes:property.numKeys,editable:!property.expressionEnabled,reason:property.expressionEnabled?'文字由表达式控制，请在 AE 中调整表达式。':'',signature:json([key,values,property.expressionEnabled])});continue;}
    if(!(layer instanceof AVLayer)||!layer.source)continue;
    var source=layer.source,isManaged=managed(source),fileSource=isManaged&&source.numLayers?source.layer(1).source:source;
    if((source instanceof FootageItem||isManaged)&&fileSource&&fileSource.file&&fileSource.hasVideo&&source.width>0){
     var ratio=layer.stretch/100,first=Math.max(0,layer.inPoint,layer.startTime),last=Math.min(comp.duration,layer.outPoint),still=!!(fileSource.mainSource&&fileSource.mainSource.isStill),reason='';
     if(layer.timeRemapEnabled)reason='此素材层启用了时间重映射，请先在 AE 内处理。';else if(ratio<=0)reason='此素材层为倒放，请先在 AE 内处理。';else if(last<=first)reason='图层不在合成的有效时间范围。';
     media.push({key:key,compId:comp.id,layerId:layer.id||0,index:i,name:layer.name,path:route.join(' / '),file:fileSource.file.fsName,isStill:still,width:source.width,height:source.height,pixelAspect:source.pixelAspect||1,sourceIn:ratio>0?(first-layer.startTime)/ratio:0,need:ratio>0?Math.max(.04,(last-first)/ratio):0,displayDuration:Math.max(0,last-first),editable:!reason,reason:reason,signature:json([key,source.id,layer.inPoint,layer.outPoint,layer.startTime,layer.stretch,layer.timeRemapEnabled])});
    }else if(source instanceof CompItem)walk(source,route.concat([source.name]));
   }
  }
  walk(root,[root.name]);
  for(var i=0;i<texts.length;i++)texts[i].shared=occurrences[texts[i].compId]>1;
  for(var i=0;i<media.length;i++)media[i].shared=occurrences[media[i].compId]>1;
  return{rootId:root.id,rootName:root.name,media:media,texts:texts};
 }
 function findLayer(slot){var comp=compById(slot.compId);for(var i=1;i<=comp.numLayers;i++){var layer=comp.layer(i);if(slot.layerId?layer.id===slot.layerId:i===slot.index)return layer;}throw Error('模板图层已不存在，请重新读取。');}
 function apply(config){
  var fresh=scan(config.rootId),slots={},i;
  for(i=0;i<fresh.media.length;i++)slots[fresh.media[i].key]=fresh.media[i];for(i=0;i<fresh.texts.length;i++)slots[fresh.texts[i].key]=fresh.texts[i];
  var changes=(config.media||[]).concat(config.texts||[]),seen={};if(!changes.length)throw Error('还没有选择需要替换的素材或修改文字。');
  for(i=0;i<changes.length;i++){var change=changes[i],slot=slots[change.key];if(!slot||!slot.editable||slot.signature!==change.signature||seen[change.key])throw Error('模板内容已变化，请重新读取合成后再应用。');seen[change.key]=true;}
  var owned=[],replaced=[],edited=[],group=false,mediaCount=0,textCount=0;
  try{
   app.beginUndoGroup('YueHai 批量套模板');group=true;
   var folder=null;if(config.media.length){folder=app.project.items.addFolder('YueHai · 替换素材');owned.push(folder);}
   var prepared=[];
   for(i=0;i<config.media.length;i++){
    var change=config.media[i],slot=slots[change.key],file=new File(change.file);if(!file.exists)throw Error('替换文件不存在：'+change.file);
    var options=new ImportOptions(file);options.sequence=false;var footage=app.project.importFile(options);owned.push(footage);footage.parentFolder=folder;
    if(!footage.hasVideo||!footage.width)throw Error('请选择图片或视频素材：'+file.name);
    var start=Number(change.start),isStill=footage.mainSource.isStill;if(!isFinite(start)||start<0)throw Error('片段起点无效。');if(isStill)start=0;
    if(!isStill&&start+slot.need>footage.duration+Math.max(.025,1/(footage.frameRate||25)))throw Error('“'+slot.name+'”所选视频片段不足 '+slot.need.toFixed(2)+' 秒，请重新选片段。');
    var original=findLayer(slot).source,duration=Math.max(slot.sourceIn+slot.need,original.duration||0,.04),rate=compById(slot.compId).frameRate;
    var wrapper=app.project.items.addComp(slot.name+' · YueHai',slot.width,slot.height,slot.pixelAspect,duration,rate);owned.push(wrapper);wrapper.comment=MARK;wrapper.parentFolder=folder;
    var content=wrapper.layers.add(footage);content.startTime=slot.sourceIn-start;content.inPoint=Math.max(0,slot.sourceIn);content.outPoint=Math.min(duration,slot.sourceIn+slot.need);
    var scale=(change.fit==='contain'?Math.min:Math.max)(slot.width/footage.width,slot.height/footage.height)*100;
    content.property('ADBE Transform Group').property('ADBE Scale').setValue([scale,scale]);content.property('ADBE Transform Group').property('ADBE Position').setValue([slot.width/2,slot.height/2]);
    prepared.push({slot:slot,source:wrapper});
   }
   for(i=0;i<prepared.length;i++){var entry=prepared[i],layer=findLayer(entry.slot),wasLocked=layer.locked;replaced.push({layer:layer,source:layer.source,locked:wasLocked});layer.locked=false;layer.replaceSource(entry.source,false);layer.locked=wasLocked;mediaCount++;}
   for(i=0;i<config.texts.length;i++){var change=config.texts[i],slot=slots[change.key],layer=findLayer(slot),property=textProperty(layer),saved=[],wasLocked=layer.locked;
    if(property.numKeys){for(var k=1;k<=property.numKeys;k++)saved.push(property.keyValue(k));}else saved.push(property.value);
    edited.push({layer:layer,property:property,values:saved,locked:wasLocked});layer.locked=false;
    if(property.numKeys){for(var k=1;k<=property.numKeys;k++){var doc=property.keyValue(k);doc.text=String(change.text);property.setValueAtKey(k,doc);}}else{var doc=property.value;doc.text=String(change.text);property.setValue(doc);}layer.locked=wasLocked;textCount++;
   }
   compById(config.rootId).openInViewer();return{media:mediaCount,texts:textCount};
  }catch(error){
   for(i=edited.length-1;i>=0;i--)try{var entry=edited[i];entry.layer.locked=false;if(entry.property.numKeys){for(var k=1;k<=entry.values.length;k++)entry.property.setValueAtKey(k,entry.values[k-1]);}else entry.property.setValue(entry.values[0]);entry.layer.locked=entry.locked;}catch(ignore){}
   for(i=replaced.length-1;i>=0;i--)try{var entry=replaced[i];entry.layer.locked=false;entry.layer.replaceSource(entry.source,false);entry.layer.locked=entry.locked;}catch(ignore){}
   for(i=owned.length-1;i>=0;i--)try{owned[i].remove();}catch(ignore){}
   throw error;
  }finally{if(group)app.endUndoGroup();}
 }
 global.YueHaiTemplates={chooseMedia:function(multiple){return response(function(){var files=File.openDialog('选择替换素材','图片或视频:*.mp4;*.mov;*.mkv;*.avi;*.webm;*.m4v;*.mxf;*.mts;*.jpg;*.jpeg;*.png;*.webp;*.tif;*.tiff;*.psd;*.exr',multiple),paths=[];if(files){if(!(files instanceof Array))files=[files];for(var i=0;i<files.length;i++)paths.push(files[i].fsName);}return{files:paths};});},list:function(){return response(function(){var comps=[],active=app.project.activeItem;for(var i=1;i<=app.project.numItems;i++){var item=app.project.item(i);if(item instanceof CompItem&&!managed(item))comps.push({id:item.id,name:item.name,duration:item.duration});}return{comps:comps,activeId:active instanceof CompItem?active.id:0};});},scan:function(id){return response(function(){return scan(id);});},apply:function(config){return response(function(){return apply(config);});}};
}($.global));
