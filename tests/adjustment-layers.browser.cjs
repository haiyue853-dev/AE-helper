const {chromium}=require('C:/Users/Admin/AppData/Local/Programs/Rea/cli/node_modules/rea-agents/node_modules/playwright-core');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/');assert.equal(await page.locator('#addAdjustmentLayer').isDisabled(),true);
 await page.route('**/js/host.js',route=>route.fulfill({contentType:'application/javascript',body:`window.YueHaiHost={isCep:true,defaultPresetRoot:()=>Promise.resolve('D:/AE/Presets'),defaultPreviewImage:()=>'',defaultPreviewOutput:()=>'',addAdjustmentLayer:()=>{window.adjustmentCalls=(window.adjustmentCalls||0)+1;return new Promise(resolve=>setTimeout(()=>resolve({count:1}),100));}};`}));
 await page.reload();await page.locator('#addAdjustmentLayer').click();assert.equal(await page.locator('#addAdjustmentLayer').isDisabled(),true);await page.waitForFunction(()=>!document.querySelector('#addAdjustmentLayer').disabled);
 assert.equal(await page.evaluate(()=>window.adjustmentCalls),1);assert.match(await page.locator('#toast').innerText(),/1 个等长调整图层/);
 await page.screenshot({path:path.resolve('artifacts/adjustment-layer-panel.png'),fullPage:true});assert.deepEqual(errors,[]);console.log('PASS: adjustment button, one host call, busy state, success feedback, browser disabled.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
