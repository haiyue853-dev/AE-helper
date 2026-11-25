const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(selected){
 function CompItem(){}function AVLayer(){}
 const comp=Object.assign(new CompItem(),{width:1080,height:1920,pixelAspect:1,duration:20,time:9}),layers=[{name:'上方',inPoint:0,outPoint:20},{name:'素材 A',inPoint:2.4,outPoint:5.8},{name:'素材 B',inPoint:8,outPoint:13.2}].map((l,i)=>Object.assign(new AVLayer(),l,{selected:selected.includes(i),hasVideo:true}));
 Object.defineProperties(comp,{selectedLayers:{get:()=>layers.filter(l=>l.selected)},numLayers:{get:()=>layers.length}});comp.layer=i=>layers[i-1];
 comp.layers={addSolid:(color,name,width,height,aspect,duration)=>{
  const source={width,height,pixelAspect:aspect,duration,usedIn:[],remove(){this.removed=true;}};
  const layer=Object.assign(new AVLayer(),{name,source,selected:true,hasVideo:true,moveBefore(target){layers.splice(layers.indexOf(this),1);layers.splice(layers.indexOf(target),0,this);},remove(){layers.splice(layers.indexOf(this),1);}});layers.unshift(layer);return layer;
 }};
 let undo=0;const sandbox={$:{global:{}},CompItem,AVLayer,app:{project:{activeItem:comp},beginUndoGroup(){undo++;},endUndoGroup(){undo--;}}};vm.runInNewContext(fs.readFileSync('YueHaiAssistant/jsx/preset-apply.jsx','utf8'),sandbox);return{api:sandbox.$.global.YueHaiPresets,comp,layers,get undo(){return undo;}};
}
test('调整图层放在各自素材正上方，匹配素材起止时间，使用合成尺寸并选中新图层',()=>{
 const s=setup([1,2]),targets=s.comp.selectedLayers.slice();assert.equal(typeof s.api.addAdjustment,'function');const result=JSON.parse(s.api.addAdjustment());assert.equal(result.ok,true);assert.equal(result.count,2);
 for(const original of targets){const adjustment=s.layers[s.layers.indexOf(original)-1];assert.equal(adjustment.adjustmentLayer,true);assert.equal(adjustment.inPoint,original.inPoint);assert.equal(adjustment.outPoint,original.outPoint);assert.equal(adjustment.startTime,original.inPoint);assert.equal(adjustment.source.width,1080);assert.equal(adjustment.source.height,1920);assert.equal(adjustment.selected,true);assert.equal(original.selected,false);}
 assert.equal(s.comp.time,9);assert.equal(s.undo,0);
});
test('未选图层和无画面图层不产生调整图层，失败时保留原图层',()=>{
 let s=setup([]);assert.match(JSON.parse(s.api.addAdjustment()).error,/选中/);assert.equal(s.layers.length,3);
 s=setup([1]);s.comp.selectedLayers[0].hasVideo=false;assert.match(JSON.parse(s.api.addAdjustment()).error,/画面|视频/);assert.equal(s.layers.length,3);
 s=setup([1]);s.comp.layers.addSolid=()=>{throw Error('模拟创建失败');};assert.equal(JSON.parse(s.api.addAdjustment()).ok,false);assert.equal(s.layers.length,3);assert.equal(s.comp.selectedLayers.length,1);assert.equal(s.undo,0);
});
