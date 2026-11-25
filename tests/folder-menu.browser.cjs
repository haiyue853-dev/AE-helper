const {chromium}=require('C:/Users/Admin/AppData/Local/Programs/Rea/cli/node_modules/rea-agents/node_modules/playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const jobs=JSON.parse(fs.readFileSync(path.join(root,'artifacts/preset-batch/jobs.json')));
const destination=folder=>JSON.stringify(['yuehai-my-presets',folder]);
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(!localStorage.getItem('folder-menu-test-seeded')){localStorage.setItem('yuehai.preview.v1',JSON.stringify({favorites:{'yuehai-lili-presets':{'/lili转场1':true}},compactLayout:true,zoom:100}));localStorage.setItem('folder-menu-test-seeded','1');}});
  await page.goto('http://127.0.0.1:4173/');
  assert.equal(await page.locator('#totalBadge').innerText(),'552');
  const initialFolder=JSON.parse(await page.locator('#librarySelect').inputValue())[1];
  assert.equal(await page.locator('.asset-card').count(),jobs.filter(j=>j.relative.startsWith(initialFolder+'/')).length);
  assert.equal(await page.locator('#folderList,#folderTrail,.folder-tile').count(),0);
  const labels=await page.locator('#librarySelect option').allTextContents();
  for(const removed of ['灵感示例','我的预设试看片','我的预设','全部预设'])assert.equal(labels.includes(removed),false);
  const paths=new Set(['LILI转场','调色2']);
  for(const job of jobs){const parts=job.relative.split('/');parts.pop();while(parts.length){paths.add(parts.join('/'));parts.pop();}}
  assert.ok(labels.length>=paths.size,'刷新后的菜单也保留磁盘上的空文件夹');
  for(const folder of paths)assert.ok(labels.includes(folder.replace(/\//g,' / ')),folder+' available directly');
  for(const folder of ['工具箱大师预设','工具箱大师预设/文字动画2.0 FFX/固定预设']){
   await page.locator('#librarySelect').selectOption(destination(folder));
   const expected=jobs.filter(j=>j.relative.startsWith(folder+'/')).length;
   assert.equal(await page.locator('.asset-card').count(),expected);
   assert.equal(await page.locator('#allTypeCount').innerText(),String(expected));
   assert.equal(await page.locator('.folder-tile').count(),0);
  }
  await page.locator('#librarySelect').selectOption(destination('调色2'));
  assert.equal(await page.locator('.asset-card.still-preview').count(),43);
  const color=page.locator('.asset-card').filter({hasText:'小辣椒调色'});await color.dblclick();await page.locator('#previewStage img').evaluate(i=>i.decode());
  assert.deepEqual(await page.locator('#previewStage img').evaluate(i=>[i.naturalWidth,i.naturalHeight]),[1179,1455]);await page.keyboard.press('Escape');
  await page.locator('#searchInput').fill('REMASTERED ICE CC');await page.locator('.asset-card').dblclick();assert.match(await page.locator('#previewStage').innerText(),/更高版本/);await page.keyboard.press('Escape');
  await page.locator('#librarySelect').selectOption(destination('LILI转场'));assert.equal(await page.locator('.asset-card.portrait-preview').count(),6);
  const lili=page.locator('.asset-card').filter({hasText:'LILI转场1'}),star=lili.locator('.star-button');assert.equal(await star.getAttribute('aria-pressed'),'true');await star.click();
  await page.reload();await page.locator('#librarySelect').selectOption(destination('LILI转场'));assert.equal(await star.getAttribute('aria-pressed'),'false');
  await lili.hover();await lili.locator('video').evaluate(v=>new Promise((resolve,reject)=>{v.loop=false;v.addEventListener('ended',resolve,{once:true});setTimeout(()=>reject(Error('LILI full playback timeout')),8000);}));
  await page.mouse.move(0,0);await page.screenshot({path:path.join(root,'artifacts/folder-menu-final.png'),fullPage:true});
  await page.setViewportSize({width:1200,height:900});assert.equal(await page.locator('#librarySelect').isVisible(),true);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',presets:552,folders:paths.size,directNestedSelection:true,noDirectoryTiles:true,noSampleLibrary:true,preservedMedia:true,preservedFavorites:true},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
