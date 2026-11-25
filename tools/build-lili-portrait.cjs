const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const renders=path.join(root,'artifacts/lili-portrait-render');
const output=path.join(root,'YueHaiAssistant/assets/lili-presets');
const log=fs.readFileSync(path.join(renders,'status.txt'),'utf8');
if(!log.includes('| DONE')||(log.match(/QUEUE_STATUS .* 3019/g)||[]).length!==6)throw Error('Six native AE renders must finish first.');
const names=['LILI转场1','LILI转场2','LILI转场3','LILI转场4','LILI转场5','LILIend'];
const checks=[];
for(let n=0;n<names.length;n++){
 const source=path.join(renders,(n+1)+'.mp4');
 const probe=JSON.parse(cp.execFileSync('D:/Topaz/ffprobe.exe',['-v','error','-show_streams','-show_format','-of','json',source],{encoding:'utf8'}));
 const video=probe.streams.find(s=>s.codec_type==='video');
 if(!video||video.width!==1088||video.height!==1344||probe.streams.some(s=>s.codec_type==='audio'))throw Error('Unexpected portrait media: '+names[n]);
 const entry=log.split(/\r?\n/).find(l=>l.includes('KEY_RANGE '+names[n]+' '));
 const keyMax=Number(entry.match(/max=([\d.]+)/)[1]);
 if(Number(probe.format.duration)<keyMax+.29)throw Error('Preview ends before the full transition: '+names[n]);
 cp.execFileSync('D:/Topaz/ffmpeg.exe',['-v','error','-i',source,'-f','null','-']);
 cp.execFileSync('D:/Topaz/ffmpeg.exe',['-v','error','-y','-ss',String(2/24),'-i',source,'-frames:v','1',path.join(output,names[n]+'.png')]);
 cp.execFileSync('D:/Topaz/ffmpeg.exe',['-v','error','-y','-i',source,'-vf','scale=120:148,tile=5x5','-frames:v','1',path.join(renders,'frames-'+(n+1)+'.png')]);
 fs.copyFileSync(source,path.join(output,names[n]+'.mp4'));
 checks.push({name:names[n],width:video.width,height:video.height,duration:Number(probe.format.duration),frames:Number(video.nb_frames),keyMax,audio:false});
}
fs.writeFileSync(path.join(renders,'checks.json'),JSON.stringify(checks,null,2));
console.log(JSON.stringify(checks,null,2));
