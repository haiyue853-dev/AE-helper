(function(global){
 function quote(value){return '"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t')+'"';}
 function point(property){var type=property.propertyValueType;return type===PropertyValueType.TwoD||type===PropertyValueType.TwoD_SPATIAL||type===PropertyValueType.ThreeD||type===PropertyValueType.ThreeD_SPATIAL;}
 function shift(property,delta,stats){
  if(Math.abs(delta[0])<.001&&Math.abs(delta[1])<.001)return;
  var values=[],keys=property.numKeys,i;for(i=0;i<(keys||1);i++)values.push(keys?property.keyValue(i+1):property.valueAtTime(0,true));
  try{for(i=0;i<values.length;i++){var next=values[i].slice(0);next[0]+=delta[0];next[1]+=delta[1];if(keys)property.setValueAtKey(i+1,next);else property.setValue(next);}stats.points++;}
  catch(error){for(i=0;i<values.length;i++)try{if(keys)property.setValueAtKey(i+1,values[i]);else property.setValue(values[i]);}catch(ignore){}stats.skipped++;}
 }
 function calibrateLayer(layer,time,first){
  var center,stats={points:0,found:0,skipped:0},effects=layer.property('ADBE Effect Parade');
  if(layer.source&&layer.source.width>0&&layer.source.height>0)center=[layer.source.width/2,layer.source.height/2];
  else{var rect=layer.sourceRectAtTime(time,false);center=[rect.left+rect.width/2,rect.top+rect.height/2];}
  function walk(group){for(var i=1;i<=group.numProperties;i++){var p=group.property(i);if(p.propertyType!==PropertyType.PROPERTY){walk(p);continue;}if(!point(p)||!/(center|centre|中心|锚点)/i.test(p.name)||/(offset|偏移)/i.test(p.name))continue;stats.found++;if(p.expressionEnabled){stats.skipped++;continue;}var base=p.valueAtTime(time,true);shift(p,[center[0]-base[0],center[1]-base[1]],stats);}}
  for(var i=first||1;i<=effects.numProperties;i++){
   var effect=effects.property(i);
   if(effect.matchName==='ADBE Geometry2'){
    var anchor=effect.property('ADBE Geometry2-0001'),position=effect.property('ADBE Geometry2-0002');
    if(anchor&&position){stats.found+=2;if(anchor.expressionEnabled||position.expressionEnabled){stats.skipped+=2;continue;}var base=anchor.valueAtTime(time,true),delta=[center[0]-base[0],center[1]-base[1]];shift(anchor,delta,stats);shift(position,delta,stats);continue;}
   }
   walk(effect);
  }
  return stats;
 }
 global.YueHaiPresets={addAdjustment:function(){
  var comp=null,targets=[],created=[],sources=[],group=false,time=0;
  try{
   comp=app.project.activeItem;if(!(comp instanceof CompItem))throw Error('请打开合成并选中素材图层。');
   var selected=comp.selectedLayers;if(!selected.length)throw Error('请先选中要添加调整图层的素材。');
   for(var i=0;i<selected.length;i++){
    var target=selected[i];if(!(target instanceof AVLayer)||!target.hasVideo)throw Error('请选择带画面的视频、图片、文字或形状图层。');
    if(!(target.outPoint>target.inPoint))throw Error('“'+target.name+'”没有有效的图层时长。');targets.push(target);
   }
   time=comp.time;app.beginUndoGroup('YueHai 添加等长调整图层');group=true;
   for(var i=0;i<targets.length;i++){
    var target=targets[i],adjustment=comp.layers.addSolid([1,1,1],'调整图层 · '+target.name,comp.width,comp.height,comp.pixelAspect,target.outPoint-target.inPoint);
    created.push(adjustment);sources.push(adjustment.source);adjustment.adjustmentLayer=true;
    adjustment.startTime=target.inPoint;adjustment.inPoint=target.inPoint;adjustment.outPoint=target.outPoint;adjustment.moveBefore(target);
   }
   for(var i=1;i<=comp.numLayers;i++)comp.layer(i).selected=false;
   for(var i=0;i<created.length;i++)created[i].selected=true;
   return '{"ok":true,"count":'+created.length+'}';
  }catch(error){
   for(var i=created.length-1;i>=0;i--)try{created[i].remove();}catch(ignore){}
   for(var i=sources.length-1;i>=0;i--)try{if(!sources[i].usedIn.length)sources[i].remove();}catch(ignore){}
   if(group)try{for(var i=1;i<=comp.numLayers;i++)comp.layer(i).selected=false;for(var i=0;i<targets.length;i++)targets[i].selected=true;}catch(ignore){}
   return '{"ok":false,"error":'+quote(error.toString())+'}';
  }finally{if(group){try{comp.time=time;}catch(ignore){}app.endUndoGroup();}}
 },calibrate:function(){
  var group=false;
  try{var comp=app.project.activeItem;if(!(comp instanceof CompItem))throw Error('请打开合成并选中要校准的图层。');var layers=comp.selectedLayers;if(!layers.length)throw Error('请先选中已添加效果的图层。');
   for(var i=0;i<layers.length;i++){if(!(layers[i] instanceof AVLayer)||!layers[i].hasVideo)throw Error('请选择带画面的视频、图片、文字或调整图层。');if(layers[i].locked)throw Error('“'+layers[i].name+'”已锁定，请先解锁。');}
   app.beginUndoGroup('YueHai 效果中心校准');group=true;var points=0,found=0,skipped=0;
   for(var i=0;i<layers.length;i++){var stats=calibrateLayer(layers[i],comp.time,1);points+=stats.points;found+=stats.found;skipped+=stats.skipped;}
   return '{"ok":true,"count":'+layers.length+',"points":'+points+',"found":'+found+',"skipped":'+skipped+'}';
  }catch(error){return '{"ok":false,"error":'+quote(error.toString())+'}';}finally{if(group)app.endUndoGroup();}
 },apply:function(path,options){
  var comp=null,selected=[],time=0,group=false,count=0,failures=[],points=0,skipped=0;
  try{
   var preset=new File(path);if(!preset.exists||! /\.ffx$/i.test(preset.name))throw Error('找不到这个预设的 FFX 文件，请重新读取预设文件夹。');
   comp=app.project.activeItem;if(!(comp instanceof CompItem))throw Error('请先在 AE 打开合成，再选中要添加效果的图层。');
   var targets=comp.selectedLayers;if(!targets.length)throw Error('请先在 AE 时间轴选中要添加效果的图层。');
   for(var i=0;i<targets.length;i++){var layer=targets[i];if(!(layer instanceof AVLayer))throw Error('请选择视频、图片、文字、形状或调整图层。');if(layer.locked)throw Error('“'+layer.name+'”已锁定，请先解锁后再应用预设。');selected.push(layer);}
   time=comp.time;app.beginUndoGroup('YueHai 应用预设');group=true;
   for(var i=0;i<selected.length;i++){
    for(var j=1;j<=comp.numLayers;j++)comp.layer(j).selected=false;
    var layer=selected[i];layer.selected=true;comp.time=time;
    try{var first=options&&options.calibrateCenters?layer.property('ADBE Effect Parade').numProperties+1:0;layer.applyPreset(preset);count++;if(first){try{var stats=calibrateLayer(layer,time,first);points+=stats.points;skipped+=stats.skipped;}catch(calibrationError){skipped++;}}}catch(error){failures.push(layer.name+'：'+error.toString());}
   }
   if(!count)throw Error('预设未能应用。'+failures.join('；'));
   return '{"ok":true,"count":'+count+',"failed":'+failures.length+',"points":'+points+',"skipped":'+skipped+',"warning":'+quote(failures.join('；'))+'}';
  }catch(error){return '{"ok":false,"error":'+quote(error.toString())+'}';}
  finally{
   if(group){try{for(var j=1;j<=comp.numLayers;j++)comp.layer(j).selected=false;for(var i=0;i<selected.length;i++)selected[i].selected=true;comp.time=time;}catch(ignore){}app.endUndoGroup();}
  }
 }};
}($.global));
