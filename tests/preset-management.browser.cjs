const {chromium}=require('C:/Users/Admin/AppData/Local/Programs/Rea/cli/node_modules/rea-agents/node_modules/playwright-core');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/js/host.js',route=>route.fulfill({contentType:'application/javascript',body:`
 function catalog(){var names=window.updated?['完成','新增','改名']:['完成','缺失','失败'];return {id:'yuehai-my-presets',name:'我的预设',builtin:true,live:true,sourceRoot:'D:/AE/Presets',folders:['甲','甲/二级','空文件夹'],failures:window.updated?{}:{'甲/二级/失败':'缺少插件'},records:names.map(function(name){return {name:name+'.ffx',relativePath:(name==='完成'?'甲/':'甲/二级/')+name+'.ffx',url:function(){return 'file:///D:/AE/Presets/'+name+'.ffx';}};}).concat([{name:'完成.png',relativePath:'甲/完成.png',url:function(){return 'assets/my-presets/'+encodeURIComponent('调色2')+'/'+encodeURIComponent('小辣椒调色')+'.png';}}]),release:function(){}};}
 window.YueHaiHost={isCep:true,refreshLibrary:()=>{window.refreshCalls=(window.refreshCalls||0)+1;return Promise.resolve(catalog());},cachedLibrary:()=>Promise.resolve(null),readCepFolder:()=>Promise.reject(Error('不可读')),
 defaultPresetRoot:()=>Promise.resolve('D:/AE/Presets'),defaultPreviewImage:()=> 'F:/YueHai助手/预览图.jpg',defaultPreviewOutput:()=> 'F:/YueHai助手/预览素材',resumeGeneration:()=>Promise.resolve(null),
 startGeneration:(options,callbacks)=>{window.generationOptions=options;callbacks.progress({status:'done',total:1,completed:1,success:1,failed:0,results:[]});return Promise.resolve({stop:()=>{}});}};
 `}));
 await page.goto('http://127.0.0.1:4173/');await page.locator('#refreshPresets').click();
 await page.waitForFunction(()=>document.querySelector('#totalBadge').textContent==='3');
 assert.ok((await page.locator('#librarySelect option').allTextContents()).includes('空文件夹'));
 await page.locator('#librarySelect').selectOption(JSON.stringify(['yuehai-my-presets','甲']));
 const ready=page.locator('.asset-card').filter({has:page.locator('.card-title').getByText('完成',{exact:true})});await ready.locator('.star-button').click();
 await page.locator('#previewStatus').selectOption('failed');assert.equal(await page.locator('.asset-card').count(),1);assert.match(await page.locator('.asset-card').innerText(),/失败/);
 await page.locator('#retryFailedPreviews').click();assert.equal(await page.locator('#generationOverlay').isVisible(),true);assert.match(await page.locator('#generationSelection').innerText(),/1/);
 await page.locator('#startGeneration').click();let options=await page.evaluate(()=>window.generationOptions);assert.deepEqual(options.relativePaths,['甲/二级/失败.ffx']);assert.equal(options.reuse,false);
 await page.locator('#closeGeneration').click();await page.locator('#previewStatus').selectOption('all');await page.locator('#fillMissingPreviews').click();await page.locator('#startGeneration').click();options=await page.evaluate(()=>window.generationOptions);assert.deepEqual(options.relativePaths,['甲/二级/缺失.ffx']);
 await page.locator('#closeGeneration').click();await ready.locator('.preset-regenerate').click();await page.locator('#startGeneration').click();options=await page.evaluate(()=>window.generationOptions);assert.deepEqual(options.relativePaths,['甲/完成.ffx']);assert.equal(options.reuse,false);
 await page.locator('#closeGeneration').click();await page.locator('#searchInput').fill('完成');await page.evaluate(()=>window.updated=true);await page.locator('#refreshPresets').click();
 await page.waitForFunction(()=>window.refreshCalls>=2&&!document.querySelector('#refreshPresets').disabled);assert.equal(await page.locator('#searchInput').inputValue(),'完成');assert.equal(await page.locator('.star-button').getAttribute('aria-pressed'),'true');
 await page.locator('#searchInput').fill('');await page.locator('#previewStatus').selectOption('failed');assert.equal(await page.locator('.asset-card').count(),0);await page.locator('#previewStatus').selectOption('all');
 assert.equal(await page.locator('.asset-card').count(),3);assert.equal(await page.locator('.card-title').filter({hasText:'失败'}).count(),0);
 await page.screenshot({path:path.resolve('artifacts/preset-management.png'),fullPage:true});assert.deepEqual(errors,[]);console.log('PASS: refresh, empty/nested folders, preserved favorites/query, preview status filters, batch missing/retry and single rerender options.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
