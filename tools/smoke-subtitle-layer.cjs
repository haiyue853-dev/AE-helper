const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),work=path.join(root,'artifacts/subtitle-smoke'),report=path.join(work,'ae-layer-report.json');
const quote=s=>JSON.stringify(s.replace(/\\/g,'/'));
if(fs.existsSync(report))fs.unlinkSync(report);
const script=`(function(){var report=new File(${quote(report)});report.encoding='UTF-8';function out(value){report.open('w');report.write(value);report.close();}
try{if(app.project.numItems!==0)throw Error('需要独立的空白 AE 进程');app.saveProjectOnCrash=false;app.beginSuppressDialogs();
$.evalFile(new File(${quote(path.join(root,'YueHaiAssistant/jsx/subtitles.jsx'))}));
var footage=app.project.importFile(new ImportOptions(new File(${quote(path.join(work,'中文测试视频.mp4'))}))),comp=app.project.items.addComp('YueHai 图层字幕测试',360,444,1,25,25),source=comp.layers.add(footage);
source.stretch=125;source.startTime=2;source.inPoint=4;source.outPoint=10;comp.openInViewer();comp.time=17;source.selected=true;
var picked=YueHaiSubtitles.readSelection(),read=eval('('+picked+')');if(!read.ok)throw Error(read.error);var context=read.sourceLayer;
if(Math.abs(context.sourceIn-1.6)>.001||Math.abs(context.sourceOut-6.4)>.001||context.offset!==4)throw Error('读取时间范围错误');
var config={video:context.video,sourceLayer:context,mode:'layer',cues:[{start:0,end:1,text:'图层自动对齐'}]},result=eval('('+YueHaiSubtitles.importCues(config)+')');
if(!result.ok||comp.numLayers!==2||Math.abs(comp.layer(1).inPoint-4)>.001||Math.abs(comp.layer(1).outPoint-5)>.001)throw Error('图层字幕偏移错误');
source.startTime=3;var stale=eval('('+YueHaiSubtitles.importCues(config)+')');if(stale.ok||comp.numLayers!==2)throw Error('图层调整后未阻止错误对齐');
out('{"ok":true,"trimAndStretch":true,"ignoresPlayhead":true,"rejectsChangedLayer":true,"sourceLayer":'+picked.replace(/^.*?"sourceLayer":/,'').replace(/}$/, '')+'}');app.endSuppressDialogs(false);
}catch(e){out('{"error":"'+encodeURIComponent(e.toString())+'"}');}}());`;
const driver=path.join(process.env.TEMP,'yuehai-subtitle-layer-smoke.jsx');fs.writeFileSync(driver,'\uFEFF'+script);
const child=cp.spawn('D:/AE2023/Adobe After Effects 2023/Support Files/AfterFX.exe',['-m','-r',driver],{windowsHide:true,stdio:'ignore'}),start=Date.now();
const timer=setInterval(()=>{if(fs.existsSync(report)){clearInterval(timer);child.kill();const result=JSON.parse(fs.readFileSync(report,'utf8'));console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;}else if(Date.now()-start>90000){clearInterval(timer);child.kill();console.error('Native AE layer test timed out');process.exitCode=1;}},500);
