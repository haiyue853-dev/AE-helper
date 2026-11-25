(function(){
 'use strict';
 function buildCues(segments,maxChars){
  maxChars=Number(maxChars)||22;var cues=[];
  (segments||[]).forEach(function(segment){
   var words=segment.words&&segment.words.length?segment.words:[{word:segment.text,start:segment.start,end:segment.end}],current=null;
   function flush(){if(current&&current.text.trim()){current.text=current.text.trim();cues.push(current);}current=null;}
   words.forEach(function(word){var text=String(word.word||''),start=Number(word.start),end=Number(word.end);if(!text.trim()||!isFinite(start)||!isFinite(end)||end<=start)return;
    if(current&&(current.text.length+text.length>maxChars||end-current.start>6||start-current.end>.7))flush();
    if(!current)current={start:Math.max(0,start),end:end,text:''};current.text+=text;current.end=end;
    if(/[。！？!?][”」"']?\s*$/.test(text))flush();
   });flush();
  });
  cues.forEach(function(cue,index){if(index)cue.start=Math.max(cue.start,cues[index-1].end);cue.end=Math.max(cue.end,cue.start+.02);});return cues;
 }
 function validate(cues){var previous=0;
  cues.forEach(function(cue,index){if(!isFinite(cue.start)||!isFinite(cue.end)||cue.start<0||cue.end<=cue.start)throw Error('第 '+(index+1)+' 条字幕时间无效。');if(index&&cue.start<previous-.0001)throw Error('第 '+(index+1)+' 条字幕时间重叠。');previous=cue.end;});return cues;
 }
 function timestamp(seconds){var ms=Math.round(seconds*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;function pad(v,n){return(new Array(n+1).join('0')+v).slice(-n);}return pad(h,2)+':'+pad(m,2)+':'+pad(s,2)+','+pad(ms%1000,3);}
 function toSrt(cues){validate(cues);return cues.filter(function(c){return String(c.text||'').trim();}).map(function(c,i){return(i+1)+'\r\n'+timestamp(c.start)+' --> '+timestamp(c.end)+'\r\n'+String(c.text).trim().replace(/\r?\n/g,'\r\n')+'\r\n';}).join('\r\n');}
 var api={buildCues:buildCues,validate:validate,toSrt:toSrt,timestamp:timestamp};
 if(typeof window!=='undefined')window.YueHaiSubtitleModel=api;if(typeof module==='object'&&module.exports)module.exports=api;
}());
