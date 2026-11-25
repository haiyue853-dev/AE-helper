const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const render = path.join(root, 'artifacts/color2-render/standard');
const output = path.join(root, 'YueHaiAssistant/assets/color2-presets');
const sources = 'D:/AE2023/Adobe After Effects 2023/Support Files/Presets/调色2';
const ffmpeg = 'D:/Topaz/ffmpeg.exe';
fs.mkdirSync(output, { recursive: true });
const log = fs.readFileSync(path.join(render, 'final-status.txt'), 'utf8');
if (!/DONE /.test(log)) throw new Error('Rendering has not finished');
const results = fs.readFileSync(path.join(render, 'final-results.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
const retryFile = path.join(render, 'retry-results.jsonl');
if (fs.existsSync(retryFile)) {
  const retries = fs.readFileSync(retryFile,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  for (const retry of retries) {
    const original = results.find(r => r.name === (retry.name === 'BERRY CC variant 0' ? 'BERRY CC' : retry.name));
    if (original && retry.status === 'success') Object.assign(original,retry);
    if (original && retry.name === 'BERRY CC variant 0') original.name = 'BERRY CC';
  }
}
const starts = [...log.matchAll(/START (\d+)\/43 (.+)/g)];
const indices = Object.fromEntries(starts.map(m => [m[2].trim(), m[1]]));
const stats = [];
for (const result of results) {
  const name = result.name;
  fs.copyFileSync(path.join(sources, name + '.ffx'), path.join(output, name + '.ffx'));
  if (result.status !== 'success') continue;
  const dir = path.join(render, 'final-raw', indices[name]);
  const frame = result.file || path.join(dir, fs.readdirSync(dir).find(n => /\.tif$/i.test(n)));
  const png = path.join(output, name + '.png');
  cp.execFileSync(ffmpeg, ['-v','error','-y','-i',frame,'-vf',`crop=1179:1455:${result.cropX||0}:${result.cropY||0}`,'-frames:v','1',png]);
  const pixels = cp.execFileSync(ffmpeg, ['-v','error','-i',png,'-vf','scale=64:64','-frames:v','1','-pix_fmt','rgba','-f','rawvideo','-']);
  let sum = 0, squares = 0, alpha = 0;
  for (let i=0;i<pixels.length;i+=4) {
    const value = (pixels[i]+pixels[i+1]+pixels[i+2])/3;
    sum += value; squares += value*value; alpha += pixels[i+3];
  }
  const count=pixels.length/4, mean=sum/count, deviation=Math.sqrt(Math.max(0,squares/count-mean*mean));
  if (mean < 3 || deviation < 1 || alpha/count < 1) {
    result.status = 'failed'; result.info = '当前 AE 渲染结果为空白或纯色，暂未提供预览图片。';
    fs.unlinkSync(png); continue;
  }
  stats.push({name,mean:+mean.toFixed(2),deviation:+deviation.toFixed(2),alpha:+(alpha/count).toFixed(2)});
}
fs.writeFileSync(path.join(render,'image-check.json'),JSON.stringify(stats,null,2));
const failures = Object.fromEntries(results.filter(r=>r.status!=='success').map(r=>[r.name,/较新版本/.test(r.info)?'需要更高版本的 After Effects，当前 AE 2023 无法完整应用此预设。':r.info]));
const entries = results.map(r=>({name:r.name,preview:r.status==='success'}));
const library = `(function () {\n  'use strict';\n  var entries = ${JSON.stringify(entries,null,2)};\n  var records = [];\n  entries.forEach(function (entry) {\n    (entry.preview ? ['ffx', 'png'] : ['ffx']).forEach(function (extension) {\n      var filename = entry.name + '.' + extension;\n      records.push({name: filename, relativePath: filename, size: 0, modified: 0,\n        url: function () {return 'assets/color2-presets/' + encodeURIComponent(filename);}});\n    });\n  });\n  window.YueHaiColor2Presets = {id: 'yuehai-color2-presets', name: '调色2', imageOnly: true,\n    description: '${stats.length} 张实际调色图片 / 43 个预设 · 使用预览图.jpg · 双击查看完整图片',\n    failures: ${JSON.stringify(failures,null,2)},\n    notes: {'iary basic bokeh': '预览已适配中文版 AE 的 Gamma 属性引用；原始预设保留。', 'BERRY CC': '此预设叠加 4 层 Looks，当前照片呈现强烈高光效果。'},\n    records: records, release: function () {}};\n}());\n`;
fs.writeFileSync(path.join(root,'YueHaiAssistant/js/color2-presets.js'),library);
console.log(JSON.stringify({total:results.length,success:stats.length,failures:results.filter(r=>r.status!=='success'),suspect:stats.filter(s=>s.mean<3||s.deviation<1||s.alpha<250)},null,2));
