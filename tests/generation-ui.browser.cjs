const {chromium}=require('C:/Users/Admin/AppData/Local/Programs/Rea/cli/node_modules/rea-agents/node_modules/playwright-core');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const web=await browser.newPage({viewport:{width:440,height:900}});await web.goto('http://127.0.0.1:4173/');await web.getByRole('button',{name:'生成预览',exact:true}).click();assert.equal(await web.locator('#generationHostNote').isVisible(),true);assert.equal(await web.locator('#startGeneration').isDisabled(),true);await web.close();
  const page=await browser.newPage({viewport:{width:440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/host.js',route=>route.fulfill({contentType:'application/javascript',body:`
   window.YueHaiHost={isCep:true,defaultPresetRoot:function(){return Promise.resolve('D:/AE/Presets');},resumeGeneration:function(){return Promise.resolve(null);},
   defaultPreviewImage:function(){return 'F:/YueHai助手/预览图.jpg';},defaultPreviewOutput:function(root){return 'F:/YueHai助手/预览素材/'+root.replace(/\\\\/g,'/').split('/').pop();},
   choosePreviewPath:function(kind){return Promise.resolve(kind==='image'?'D:/图片/预览图.jpg':kind==='output'?'D:/预览输出':'D:/我的特效');},
   startGeneration:function(options,callbacks){window.__generationOptions=options;callbacks.progress({total:1,completed:0,success:0,failed:0,status:'running',current:'我的转场',results:[]});
    setTimeout(function(){callbacks.library({generated:true,path:options.outputRoot,prefix:'新预设',name:'新预设',portrait:true,records:['ffx','png','mp4'].map(function(ext){return{name:'我的转场.'+ext,relativePath:'我的转场.'+ext,url:function(){return 'assets/lili-presets/'+encodeURIComponent('LILI转场1')+'.'+ext;}};}),release:function(){}},true);
    callbacks.progress({total:1,completed:1,success:1,failed:0,status:'done',results:[{name:'我的转场',status:'success'}]});},80);return Promise.resolve({stop:function(){}});}
   };
  `}));
  await page.addInitScript(()=>localStorage.setItem('yuehai.generator.v1',JSON.stringify({image:'D:/自定义/旧底图.jpg',presetRoot:'D:/旧预设',outputRoot:'D:/旧预设/_YueHai预览'})));
  await page.goto('http://127.0.0.1:4173/');await page.getByRole('button',{name:'生成预览',exact:true}).click();
  assert.equal(await page.locator('#generationImage').inputValue(),'D:/自定义/旧底图.jpg');
  assert.equal(await page.locator('#generationOutput').inputValue(),'F:/YueHai助手/预览素材/旧预设');
  await page.locator('[data-generation-pick="image"]').click();await page.locator('[data-generation-pick="presets"]').click();await page.locator('#startGeneration').click();
  await page.waitForFunction(()=>document.querySelector('#generationStatus').textContent.includes('1 个完成'));
  const options=await page.evaluate(()=>window.__generationOptions);assert.equal(options.image,'D:/图片/预览图.jpg');assert.equal(options.outputRoot,'F:/YueHai助手/预览素材/我的特效');assert.equal(options.text,'adc');assert.equal(options.minimumDuration,4);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('yuehai.generator.v1')));assert.equal(saved.image,options.image);assert.equal(saved.storageVersion,2);
  assert.equal(await page.locator('.asset-card').count(),1);assert.equal(await page.locator('.card-title').innerText(),'我的转场');
  const labels=await page.locator('#librarySelect option').allTextContents();assert.equal(labels.filter(x=>x==='新预设').length,1);assert.equal(labels.includes('_YueHai预览'),false);
  await page.screenshot({path:path.join(__dirname,'../artifacts/automatic-preview-panel.png'),fullPage:true});
  await page.locator('#closeGeneration').click();await page.locator('.asset-card').hover();await page.waitForFunction(()=>document.querySelector('.asset-card video')?.videoHeight===1344);
  assert.deepEqual(errors,[]);console.log('PASS: AE generation form, start/progress/completion, automatic folder merge, playable preview; browser mode clearly requires AE.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
