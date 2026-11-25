const test=require('node:test'),assert=require('node:assert/strict');
const model=require('../YueHaiAssistant/js/template-model.js');
test('长视频按槽位时长选择片段，超出末尾自动夹紧，短素材不能误报可用',()=>{
 assert.deepEqual(model.range(120,4,119),{start:116,end:120,duration:4,valid:true});
 assert.equal(model.range(2,4,0).valid,false);assert.equal(model.range(120,4,30).end,34);
});
test('批量选择素材按可替换槽位顺序配对，只提交有改动的素材和文字',()=>{
 const scan={rootId:1,media:[{key:'a',signature:'s1',editable:true},{key:'b',signature:'s2',editable:false},{key:'c',signature:'s3',editable:true}],texts:[{key:'t',signature:'st',text:'原文',editable:true}]};
 const drafts=model.assign(scan.media,['one.mp4','two.jpg']);assert.equal(drafts.a.file,'one.mp4');assert.equal(drafts.c.file,'two.jpg');
 const patch=model.patch(scan,drafts,{t:'新文'});assert.equal(patch.media.length,2);assert.equal(patch.texts[0].text,'新文');assert.equal(model.patch(scan,{}, {t:'原文'}).texts.length,0);
});
