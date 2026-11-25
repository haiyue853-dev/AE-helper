const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Admin/AppData/Local/Programs/Rea/cli/node_modules/rea-agents/node_modules/playwright-core');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:740}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/responsive-video.mp4?*',route=>{const bytes=fs.readFileSync(path.resolve('artifacts/template-smoke/proxy.mp4')),match=/^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range||''),start=match?Number(match[1]):0,end=match&&match[2]?Math.min(Number(match[2]),bytes.length-1):bytes.length-1;return route.fulfill({status:match?206:200,contentType:'video/mp4',headers:Object.assign({'Accept-Ranges':'bytes'},match?{'Content-Range':'bytes '+start+'-'+end+'/'+bytes.length}:{}),body:bytes.subarray(start,end+1)});});
 await page.route('**/js/host.js',route=>route.fulfill({contentType:'application/javascript',body:`
 var scan={rootId:1,rootName:'响应式模板',media:[1,2,3].map(i=>({key:'m'+i,signature:'s'+i,editable:true,name:'镜头'+i,path:'主合成 / 预合成'+i,file:'原始'+i+'.mp4',need:i+1,width:1080,height:1920})),texts:[]};
 window.YueHaiHost={isCep:true,defaultPreviewImage:()=>'',defaultPreviewOutput:()=>'',defaultPresetRoot:()=>Promise.resolve('D:/AE/Presets'),templateComps:()=>Promise.resolve({activeId:1,comps:[{id:1,name:'响应式模板'}]}),scanTemplate:()=>Promise.resolve(scan),chooseTemplateMedia:()=>Promise.resolve(['D:/长视频1.mp4','D:/长视频2.mp4','D:/长视频3.mp4']),templateMediaUrl:file=>'http://127.0.0.1:4173/responsive-video.mp4?slot='+encodeURIComponent(file),templatePreview:()=>Promise.reject(Error('不应需要代理')),applyTemplate:config=>{window.applied=config;return Promise.resolve({media:config.media.length,texts:0});}};
 `}));
 await page.goto('http://127.0.0.1:4173/');await page.locator('#openTemplates').click();await page.locator('#batchTemplateMedia').click();await page.waitForFunction(()=>!document.querySelector('#templateClipControls').hidden);
 async function choose(slot,start){
  await page.locator('[data-slot="m'+slot+'"] .template-slot-name').click();await page.waitForFunction(()=>!document.querySelector('#templateClipControls').hidden);
  const visible=await page.locator('#templateTimeline').evaluate(element=>{const box=element.getBoundingClientRect(),container=element.closest('.template-content').getBoundingClientRect();return box.top>=container.top-1&&box.bottom<=container.bottom+1;});
  assert.equal(visible,true,'镜头'+slot+'的拖动时间轴应自动进入可见区域');
  if(page.viewportSize().height>=620&&page.viewportSize().width<=650)assert.equal(await page.locator('#templateVideo').evaluate(element=>{const box=element.getBoundingClientRect(),container=element.closest('.template-content').getBoundingClientRect();return box.top>=container.top-1&&box.bottom<=container.bottom+1;}),true,'空间足够时视频画面应与时间轴一起显示');
  await page.locator('#templateStart').fill(String(start));await page.locator('#templateStart').dispatchEvent('change');
 }
 await choose(1,2);await choose(2,6);await choose(3,9);await choose(1,2);assert.equal(await page.locator('#templateStart').inputValue(),'2.00');await choose(2,6);assert.equal(await page.locator('#templateStart').inputValue(),'6.00');
 await page.setViewportSize({width:350,height:400});await page.waitForFunction(()=>{const box=document.querySelector('#templateTimeline').getBoundingClientRect(),container=document.querySelector('.template-content').getBoundingClientRect();return box.top>=container.top-1&&box.bottom<=container.bottom+1;});assert.equal(await page.locator('#templateEditTitle').innerText(),'镜头2');assert.equal(await page.locator('#templateStart').inputValue(),'6.00');
 for(const viewport of [{width:350,height:400},{width:440,height:620},{width:700,height:500},{width:1100,height:800}]){
  await page.setViewportSize(viewport);await choose(3,9);assert.equal(await page.locator('#templatePage').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'套工程页面不能横向溢出');
 }
 await page.locator('#applyTemplate').click();await page.waitForFunction(()=>!!window.applied);const applied=await page.evaluate(()=>window.applied);assert.deepEqual(applied.media.map(m=>m.start),[2,6,9]);
 await page.locator('#closeTemplates').click();for(const viewport of [{width:350,height:400},{width:440,height:740},{width:1100,height:800}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'主面板不能横向溢出');}
 await page.setViewportSize({width:390,height:620});await page.locator('#openTemplates').click();await page.locator('#batchTemplateMedia').click();await choose(2,6);await page.screenshot({path:path.resolve('artifacts/template-smoke/template-responsive.png')});
 assert.deepEqual(errors,[]);console.log('PASS: all video slots open visible timelines, independent trim points, resize across 350–1100 px, compact height, no horizontal overflow.');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
