(function(){
 'use strict';
 function range(total,need,start){total=Math.max(0,Number(total)||0);need=Math.max(.001,Number(need)||.001);start=Math.max(0,Math.min(Number(start)||0,Math.max(0,total-need)));return{start:start,end:Math.min(total,start+need),duration:need,valid:total+.025>=need};}
 function assign(slots,files){var drafts={},index=0;slots.forEach(function(slot){if(slot.editable&&index<files.length)drafts[slot.key]={file:files[index++],start:0,fit:'fill'};});return drafts;}
 function patch(scan,drafts,texts){return{rootId:scan.rootId,media:scan.media.filter(function(s){return s.editable&&drafts[s.key]&&drafts[s.key].file;}).map(function(s){var d=drafts[s.key];return{key:s.key,signature:s.signature,file:d.file,start:Number(d.start)||0,fit:d.fit==='contain'?'contain':'fill'};}),texts:scan.texts.filter(function(s){return s.editable&&Object.prototype.hasOwnProperty.call(texts,s.key)&&texts[s.key]!==s.text;}).map(function(s){return{key:s.key,signature:s.signature,text:String(texts[s.key])};})};}
 var api={range:range,assign:assign,patch:patch};if(typeof window!=='undefined')window.YueHaiTemplateModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
}());
