const fs=require('node:fs'),path=require('node:path');
const generation=require('../YueHaiAssistant/js/preview-generation.cjs');
const root=path.resolve(__dirname,'..'),particleOnly=process.argv.includes('--particle'),work=path.join(root,'artifacts/automatic-preview-smoke'+(particleOnly?'-particle':''));
fs.mkdirSync(work,{recursive:true});
const presetRoot='D:/AE2023/Adobe After Effects 2023/Support Files/Presets';
for(const [from,to] of [['LILI转场/LILI转场1.ffx','转场/LILI转场1.ffx'],['LILI专场包2/文本1.ffx','文字/文本1.ffx'],['调色2/小辣椒调色.ffx','调色/小辣椒调色.ffx'],['粒子/爱心粒子.ffx','粒子/爱心粒子.ffx']]){
 if(particleOnly&&!from.startsWith('粒子/'))continue;
 const dest=path.join(work,'source',to);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(presetRoot,from),dest);
}
const output=path.join(work,'output-'+Date.now());
const prepared=generation.prepare({image:path.join(root,'预览图.jpg'),presetRoot:path.join(work,'source'),outputRoot:output,presetBase:path.join(work,'source'),minimumDuration:2,text:'adc'});
fs.writeFileSync(path.join(work,'latest.json'),JSON.stringify(prepared,null,2));
if(fs.existsSync(path.join(work,'native-check.json')))fs.unlinkSync(path.join(work,'native-check.json'));
const quote=JSON.stringify;
const jsx=`(function(){
 var report=new File(${quote(path.join(work,'native-check.json').replace(/\\/g,'/'))});report.encoding='UTF-8';
 function reportText(s){report.open('w');report.write(s);report.close();}
 try{
  if(app.project.numItems!==0){reportText('{"error":"Test needs a separate empty AE project"}');return;}
  var sentinel=app.project.items.addComp('YueHai_Test_Existing_Project',320,240,1,3,24);sentinel.layers.addSolid([.2,.3,.4],'YueHai_Test_Existing_Layer',320,240,1);sentinel.openInViewer();sentinel.time=.5;
  var queued=app.project.renderQueue.items.add(sentinel);queued.outputModule(1).file=new File(${quote(path.join(work,'must-not-render.avi').replace(/\\/g,'/'))});
  var count=app.project.numItems,projectIds=[];for(var i=1;i<=count;i++)projectIds.push(app.project.item(i).id);var gpu=app.project.gpuAccelType;
  $.evalFile(new File(${quote(path.join(root,'YueHaiAssistant/jsx/preview-engine.jsx').replace(/\\/g,'/'))}));
  $.evalFile(new File(${quote(path.join(prepared.runDir,'config.jsx').replace(/\\/g,'/'))}));
  var started=YueHaiPreviewEngine.start(YUEHAI_PREVIEW_CONFIG);
  $.global.YueHaiSmokeWatch=function(){
   if(YueHaiPreviewEngine.busy){app.scheduleTask('YueHaiSmokeWatch()',200,false);return;}
   var same=app.project.numItems===count;for(var i=1;i<=app.project.numItems;i++)if(projectIds.join('|').indexOf(String(app.project.item(i).id))<0)same=false;
   var queue=app.project.renderQueue.numItems===1&&queued.status===RQItemStatus.QUEUED&&queued.render;
   var active=app.project.activeItem===sentinel&&Math.abs(sentinel.time-.5)<.0001;
   var restoredGpu=app.project.gpuAccelType===gpu;
   var results=new File(YUEHAI_PREVIEW_CONFIG.runDir+'/results.json');results.encoding='UTF-8';results.open('r');var rows=results.read();results.close();
   reportText('{"projectPreserved":'+same+',"queuePreserved":'+queue+',"viewerPreserved":'+active+',"gpuPreserved":'+restoredGpu+',"results":'+rows+'}');
   if(same&&queue){app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);app.quit();}
  };
  YueHaiSmokeWatch();
 }catch(e){reportText('{"error":'+String('"'+e.toString().replace(/"/g,'\\"')+'"')+'}');}
}());`;
const driver=path.join(process.env.TEMP,'yuehai-automatic-preview-smoke.jsx');fs.writeFileSync(driver,'\uFEFF'+jsx);
console.log(JSON.stringify({driver,output,jobs:prepared.config.jobs.map(j=>({name:j.name,kind:j.kind}))},null,2));
