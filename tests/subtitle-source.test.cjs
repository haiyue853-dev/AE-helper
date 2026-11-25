const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function context(layer){function CompItem(){}function FootageItem(){}function AVLayer(){}const comp=new CompItem();comp.id=12;comp.name='合成';comp.duration=20;comp.selectedLayers=layer?[Object.assign(new AVLayer(),layer)]:[];const sandbox={app:{project:{activeItem:comp}},CompItem,FootageItem,AVLayer,File:function(){},$: {global:{}}};if(layer){sandbox.app.project.activeItem.selectedLayers[0].source=Object.assign(new FootageItem(),{file:{exists:true,fsName:'D:/测试.mp4'},hasAudio:true,duration:30});}vm.runInNewContext(fs.readFileSync('YueHaiAssistant/jsx/subtitles.jsx','utf8'),sandbox);return sandbox;}
test('读取选中图层，保留剪入点、偏移和变速后的实际音频范围',()=>{
 const c=context({id:27,index:2,name:'剪辑',hasAudio:true,stretch:125,inPoint:4,outPoint:10,startTime:2,timeRemapEnabled:false});const result=JSON.parse(c.$.global.YueHaiSubtitles.readSelection());assert.equal(result.ok,true);assert.equal(result.sourceLayer.offset,4);assert.equal(result.sourceLayer.sourceIn,1.6);assert.equal(result.sourceLayer.sourceOut,6.4);assert.equal(result.sourceLayer.compId,12);
});
test('未选中图层和时间重映射给出明确提示',()=>{
 assert.match(JSON.parse(context(null).$.global.YueHaiSubtitles.readSelection()).error,/选中/);
 assert.match(JSON.parse(context({hasAudio:true,timeRemapEnabled:true,stretch:100}).$.global.YueHaiSubtitles.readSelection()).error,/时间重映射/);
});
