const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),work=path.join(root,'artifacts/subtitle-smoke'),latest=JSON.parse(fs.readFileSync(path.join(work,'latest.json'))),backend=require('../YueHaiAssistant/js/subtitle-jobs.cjs');
const result=JSON.parse(fs.readFileSync(path.join(latest.directory,'subtitle.json'))),config=backend.importConfig(latest.directory,result.cues,'new'),report=path.join(work,'ae-report.json'),video=path.join(work,'ae-subtitles.mp4');
if(fs.existsSync(report))fs.unlinkSync(report);
const quote=s=>JSON.stringify(s.replace(/\\/g,'/'));
const script=`(function(){var report=new File(${quote(report)});report.encoding='UTF-8';function out(value){report.open('w');report.write(value);report.close();}
 try{if(app.project.numItems!==0){out('{"error":"需要独立的空白 AE 进程"}');return;}app.saveProjectOnCrash=false;app.beginSuppressDialogs();
 $.evalFile(new File(${quote(path.join(root,'YueHaiAssistant/jsx/subtitles.jsx'))}));$.evalFile(new File(${quote(config)}));
 var response=eval('('+YueHaiSubtitles.importCues(YUEHAI_SUBTITLES)+')');if(!response.ok)throw Error(response.error);
 var comp=app.project.activeItem,valid=comp instanceof CompItem&&comp.numLayers===YUEHAI_SUBTITLES.cues.length+1;
 for(var i=1;i<comp.numLayers;i++){var layer=comp.layer(i),cue=YUEHAI_SUBTITLES.cues[i-1];valid=valid&&Math.abs(layer.inPoint-cue.start)<.11&&Math.abs(layer.outPoint-cue.end)<.11&&layer.property('ADBE Text Properties').property('ADBE Text Document').value.text===cue.text;}
 comp.time=2;var count=comp.numLayers,footageId=comp.layer(count).id;YUEHAI_SUBTITLES.mode='current';var second=eval('('+YueHaiSubtitles.importCues(YUEHAI_SUBTITLES)+')');var offset=second.ok&&comp.numLayers===count+second.count&&comp.layer(comp.numLayers).id===footageId&&Math.abs(comp.layer(1).inPoint-2)<.11;
 for(var i=0;i<second.count;i++)comp.layer(1).remove();
 var rq=app.project.renderQueue.items.add(comp);rq.timeSpanStart=0;rq.timeSpanDuration=1;var om=rq.outputModule(1),templates=om.templates;for(var i=0;i<templates.length;i++)if(/H.264/.test(templates[i])){om.applyTemplate(templates[i]);break;}om.file=new File(${quote(video)});app.project.renderQueue.render();var rendered=rq.status===RQItemStatus.DONE;
 out('{"newComposition":'+valid+',"currentCompositionOffset":'+offset+',"textLayers":'+response.count+',"rendered":'+rendered+'}');app.endSuppressDialogs(false);
 }catch(e){out('{"error":"'+encodeURIComponent(e.toString())+'"}');}}());`;
const driver=path.join(process.env.TEMP,'yuehai-subtitle-import-smoke.jsx');fs.writeFileSync(driver,'\uFEFF'+script);
const child=cp.spawn('D:/AE2023/Adobe After Effects 2023/Support Files/AfterFX.exe',['-m','-r',driver],{windowsHide:true,stdio:'ignore'}),start=Date.now();
const timer=setInterval(()=>{if(fs.existsSync(report)){clearInterval(timer);child.kill();console.log(fs.readFileSync(report,'utf8'));}else if(Date.now()-start>90000){clearInterval(timer);child.kill();console.error('Native AE subtitle test timed out');process.exitCode=1;}},500);
