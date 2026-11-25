const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Admin/AppData/Local/Programs/Rea/cli/node_modules/rea-agents/node_modules/playwright-core');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const web=await browser.newPage({viewport:{width:440,height:850}});await web.goto('http://127.0.0.1:4173/');await web.locator('#openSubtitles').click();assert.equal(await web.locator('#startSubtitles').isDisabled(),true);assert.equal(await web.locator('#subtitleHostNote').isVisible(),true);await web.close();
  const latest=JSON.parse(fs.readFileSync(path.join(__dirname,'../artifacts/subtitle-smoke/latest.json'))),real=JSON.parse(fs.readFileSync(path.join(latest.directory,'subtitle.json')));
  const page=await browser.newPage({viewport:{width:440,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/js/host.js',route=>route.fulfill({contentType:'application/javascript',body:`
   window.YueHaiHost={isCep:true,defaultPreviewImage:()=>'',defaultPreviewOutput:()=>'',defaultPresetRoot:()=>Promise.resolve('D:/AE/Presets'),resumeGeneration:()=>Promise.resolve(null),
    subtitleStatus:()=>({ready:true,message:'本地模型已就绪'}),chooseSubtitleVideo:()=>Promise.resolve(${JSON.stringify(real.video)}),
    selectedSubtitleLayer:()=>Promise.resolve({video:${JSON.stringify(real.video)},compId:12,layerId:27,layerName:'对白剪辑',compName:'成片',offset:4,sourceIn:2,sourceOut:8,stretch:100}),
    startSubtitles:(options,callbacks)=>{window.receivedSubtitleOptions=options;callbacks.update({state:'running',terminal:false,message:'识别中',percent:20,cues:[],count:0,sourceLayer:options.sourceLayer,directory:${JSON.stringify(real.directory)}});setTimeout(()=>callbacks.update({state:'done',terminal:true,message:'识别完成',percent:100,cues:${JSON.stringify(real.cues)},count:${real.cues.length},sourceLayer:options.sourceLayer,directory:${JSON.stringify(real.directory)},result:${JSON.stringify(real)}}),60);return{config:{directory:${JSON.stringify(real.directory)}},cancel:()=>{}};},
    saveSubtitles:(dir,cues)=>{window.savedSubtitleCues=cues;return{srt:'F:/YueHai助手/字幕/已校对.srt'};},
    importSubtitles:(dir,cues,mode)=>{window.importedSubtitle={cues,mode};return Promise.resolve({count:cues.length,skipped:0});},openSubtitleFolder:()=>{}
   };` }));
  await page.goto('http://127.0.0.1:4173/');await page.locator('#openSubtitles').click();await page.locator('#chooseSubtitleVideo').click();await page.locator('#subtitleLanguage').selectOption('zh');await page.locator('#subtitleQuality').selectOption('fast');await page.locator('#subtitleDevice').selectOption('cpu');await page.locator('#startSubtitles').click();await page.waitForFunction(()=>document.querySelector('#subtitleEditor textarea')&&!document.querySelector('#subtitleEditor textarea').readOnly);
  assert.equal(await page.locator('#subtitleEditor textarea').count(),real.cues.length);assert.equal((await page.evaluate(()=>window.receivedSubtitleOptions)).language,'zh');
  assert.equal((await page.evaluate(()=>window.receivedSubtitleOptions)).quality,'fast');assert.equal((await page.evaluate(()=>window.receivedSubtitleOptions)).device,'cpu');
  const edited='校对后的字幕 "AE" & <文字>';await page.locator('#subtitleEditor textarea').first().fill(edited);await page.locator('#saveSubtitles').click();assert.equal((await page.evaluate(()=>window.savedSubtitleCues))[0].text,edited);
  await page.locator('#subtitleDestination').selectOption('current');await page.locator('#importSubtitles').click();await page.waitForFunction(()=>document.querySelector('#subtitleStatus').textContent.includes('已放入 AE'));assert.equal((await page.evaluate(()=>window.importedSubtitle)).mode,'current');
  await page.locator('#readSubtitleLayer').click();await page.waitForFunction(()=>document.querySelector('#subtitleSourceInfo').textContent.includes('对白剪辑'));await page.locator('#startSubtitles').click();await page.waitForFunction(()=>document.querySelector('#subtitleEditor textarea')&&!document.querySelector('#subtitleEditor textarea').readOnly);
  assert.equal((await page.evaluate(()=>window.receivedSubtitleOptions)).sourceLayer.compId,12);assert.equal(await page.locator('#subtitleDestination').inputValue(),'layer');await page.locator('#importSubtitles').click();await page.waitForFunction(()=>window.importedSubtitle.mode==='layer');
  await page.locator('#chooseSubtitleVideo').click();assert.equal(await page.locator('#subtitleDestination').inputValue(),'new');assert.equal(await page.locator('#importSubtitles').isDisabled(),true);
  await page.screenshot({path:path.join(__dirname,'../artifacts/local-subtitles-panel.png')});await page.locator('#closeSubtitles').click();assert.equal(await page.locator('.asset-card').count()>0,true);assert.deepEqual(errors,[]);
  console.log('PASS: local subtitle entry, real recognition result display, editing, SRT handoff, AE destination, unchanged preset browser.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
