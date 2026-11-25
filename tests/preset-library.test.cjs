const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const library=require('../YueHaiAssistant/js/preset-library.cjs');
test('刷新读取真实多级目录，原 FFX 与已生成预览配对，删除和改名不会留下旧卡片',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'yuehai-library-')),source=path.join(root,'Presets'),output=path.join(root,'预览素材');
 try{
  fs.mkdirSync(path.join(source,'一级','二级'),{recursive:true});fs.mkdirSync(path.join(output,'一级','二级'),{recursive:true});
  const original=path.join(source,'一级','二级','转场.ffx');fs.writeFileSync(original,'ADBE motion');
  const s=fs.statSync(original),signature=original.replace(/\\/g,'/')+'|'+s.size+'|'+s.mtimeMs;
  fs.writeFileSync(path.join(output,'一级','二级','转场.png'),'image');
  fs.writeFileSync(path.join(output,'.yuehai-preview.json'),JSON.stringify({version:1,sourceRoot:source,portrait:true,jobs:{'一级/二级/转场.ffx':{signature,status:'success'}}}));
  let result=library.refresh(source,{storageRoot:output});
  assert.equal(result.records.length,2);assert.equal(result.records.find(r=>/ffx$/.test(r.name)).filePath,original.replace(/\\/g,'/'));
  assert.equal(result.previewStates['一级/二级/转场'],'ready');
  fs.renameSync(original,path.join(source,'一级','二级','改名.ffx'));
  result=library.refresh(source,{storageRoot:output});
  assert.deepEqual(result.records.map(r=>r.relativePath),['一级/二级/改名.ffx']);
  assert.equal(result.previewStates['一级/二级/改名'],'missing');
  assert.equal(result.previewStates['一级/二级/转场'],undefined);
  const saved=JSON.parse(fs.readFileSync(path.join(output,'.yuehai-library.json'),'utf8'));assert.equal(saved.records[0].name,'改名.ffx');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('失败原因、失效预览、空文件夹和下级输出清单都能刷新，扫描失败不覆盖上次结果',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'yuehai-library-')),source=path.join(root,'Presets'),output=path.join(root,'预览素材');
 try{
  fs.mkdirSync(path.join(source,'空目录'),{recursive:true});fs.mkdirSync(path.join(output,'子目录'),{recursive:true});
  for(const name of ['失败','缺失','完成'])fs.writeFileSync(path.join(source,name+'.ffx'),'motion');
  const signature=name=>{const file=path.join(source,name+'.ffx'),s=fs.statSync(file);return file.replace(/\\/g,'/')+'|'+s.size+'|'+s.mtimeMs;};
  fs.writeFileSync(path.join(output,'子目录','完成.mp4'),'video');
  fs.writeFileSync(path.join(output,'子目录','.yuehai-preview.json'),JSON.stringify({version:1,sourceRoot:source,jobs:{'完成.ffx':{signature:signature('完成'),status:'success'},'失败.ffx':{signature:signature('失败'),status:'failed',info:'缺少插件'}}}));
  let result=library.refresh(source,{storageRoot:output});assert.equal(result.previewStates['/完成'],'ready');assert.equal(result.previewStates['/失败'],'failed');assert.match(result.failures['/失败'],/缺少插件/);assert.ok(result.folders.includes('空目录'));
  fs.appendFileSync(path.join(source,'完成.ffx'),'changed');result=library.refresh(source,{storageRoot:output});assert.equal(result.previewStates['/完成'],'missing');assert.equal(result.records.some(r=>/mp4$/.test(r.name)),false);
  const previous=fs.readFileSync(path.join(output,'.yuehai-library.json'),'utf8');assert.throws(()=>library.refresh(path.join(root,'不存在'),{storageRoot:output}));assert.equal(fs.readFileSync(path.join(output,'.yuehai-library.json'),'utf8'),previous);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
