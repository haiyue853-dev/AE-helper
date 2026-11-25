const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source='D:/AE2023/Adobe After Effects 2023/Support Files/Presets';
const builtin=new Set(['Backgrounds','Behaviors','Image - Creative','Image - Special Effects','Image - Utilities','Shapes','Sound Effects','Synthetics','Text','Transform','Transitions - Dissolves','Transitions - Movement','Transitions - Wipes']);
const completed=new Set(['调色2','LILI转场']);
const jobs=[],folders={};
function visit(dir,relative=''){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const rel=relative?relative+'/'+entry.name:entry.name;
  const top=rel.split('/')[0];
  if(builtin.has(top)||completed.has(top))continue;
  const absolute=path.join(dir,entry.name);
  if(entry.isDirectory()){visit(absolute,rel);continue;}
  if(!/\.ffx$/i.test(entry.name))continue;
  const raw=fs.readFileSync(absolute).toString('latin1');
  const text=/ADBE Text/.test(raw)||/文本|字体|文字/.test(rel);
  const color=/^调色|^温向竹cc$/.test(top);
  jobs.push({id:String(jobs.length+1).padStart(4,'0'),relative:rel,name:entry.name.replace(/\.ffx$/i,''),folder:top,source:absolute.replace(/\\/g,'/'),kind:text?'text':color?'color':/ADBE Vector/.test(raw)?'shape':'motion'});
  folders[top]=(folders[top]||0)+1;
 }
}
visit(source);
const out=path.join(root,'artifacts/preset-batch');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'jobs.json'),JSON.stringify(jobs,null,2));
fs.writeFileSync(path.join(out,'jobs.jsx'),'\uFEFFvar YUEHAI_BATCH_JOBS = '+JSON.stringify(jobs)+';\n');
console.log(JSON.stringify({remaining:jobs.length,types:jobs.reduce((a,j)=>(a[j.kind]=(a[j.kind]||0)+1,a),{}),folders},null,2));
