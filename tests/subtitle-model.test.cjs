const test=require('node:test'),assert=require('node:assert/strict');
let model;try{model=require('../YueHaiAssistant/js/subtitle-model.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
test('字幕按词级时间断句，保留中文和英文的原始文字、静音间隔与末尾',()=>{
 assert.ok(model,'本地字幕模型尚未实现');
 const cues=model.buildCues([{start:0,end:4,words:[{word:'你好，',start:0,end:.8},{word:'欢迎使用',start:.8,end:1.7},{word:'悦海助手。',start:1.7,end:2.8},{word:' Hello',start:3,end:3.4},{word:' world!',start:3.4,end:4}]}],14);
 assert.equal(cues.map(c=>c.text).join(''),'你好，欢迎使用悦海助手。Hello world!');
 assert.equal(cues[0].start,0);assert.equal(cues.at(-1).end,4);
 for(let i=0;i<cues.length;i++){assert.ok(cues[i].end>cues[i].start);if(i)assert.ok(cues[i].start>=cues[i-1].end);}
 assert.equal(cues.at(-1).start,3);
 const short=model.buildCues([{words:[{word:'你好，',start:0,end:.8},{word:'欢迎使用',start:.8,end:1.7},{word:'悦海助手。',start:1.7,end:2.8}]}],8);
 assert.equal(short.length,2);assert.ok(short.every(c=>c.text.length<=8));assert.equal(short[1].start,1.7);
});
test('SRT 毫秒进位正确，中文与引号按文本保存；拒绝非法和重叠时间',()=>{
 assert.ok(model,'本地字幕模型尚未实现');
 const srt=model.toSrt([{start:59.9996,end:61.2,text:'你好 "YueHai" & AE'}]);
 assert.equal(srt,'1\r\n00:01:00,000 --> 00:01:01,200\r\n你好 "YueHai" & AE\r\n');
 assert.throws(()=>model.toSrt([{start:2,end:1,text:'错误'}]),/时间/);
 assert.throws(()=>model.toSrt([{start:0,end:2,text:'一'},{start:1,end:3,text:'二'}]),/重叠/);
 assert.deepEqual(model.buildCues([],20),[]);
});
