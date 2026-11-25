const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../YueHaiAssistant');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webm': 'video/webm', '.mp4': 'video/mp4' };
const port = Number(process.env.PORT || 4173);
const generation=require('../YueHaiAssistant/js/preview-generation.cjs'),catalog=require('../YueHaiAssistant/js/preset-library.cjs');
let allowedMedia=new Set();
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(ignore){return null;}}
function allow(library){if(library)library.records.forEach(record=>allowedMedia.add(path.resolve(record.filePath)));return library;}
http.createServer((request, response) => {
  let pathname,url;
  try { url=new URL(request.url,'http://localhost');pathname = decodeURIComponent(url.pathname); } catch { response.writeHead(400).end(); return; }
  if(pathname==='/__yuehai/library'){
    try{
      const settings=generation.defaults(),snapshot=readJson(path.join(settings.storageRoot,'.yuehai-library.json'));
      let library=snapshot;
      if(request.method==='POST'){
        if(request.headers['x-yuehai-request']!=='1')throw Error('请使用面板刷新按钮。');
        const manifest=readJson(path.join(settings.storageRoot,'.yuehai-preview.json')),source=settings.presetRoot||(snapshot&&snapshot.sourceRoot)||(manifest&&manifest.sourceRoot);
        if(!source)throw Error('请先在 AE 面板刷新一次预设目录。');
        library=catalog.refresh(source,{storageRoot:settings.storageRoot});
      }else if(request.method!=='GET'){response.writeHead(405).end();return;}
      response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(allow(library)));
    }catch(error){response.writeHead(400,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify({error:error.message}));}return;
  }
  let target;
  if(pathname==='/__yuehai/media'){
    target=path.resolve(url.searchParams.get('file')||'');
    if(!allowedMedia.has(target))allow(readJson(path.join(generation.defaults().storageRoot,'.yuehai-library.json')));
    if(!allowedMedia.has(target)){response.writeHead(403).end();return;}
  }else{
    target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  }
  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) { response.writeHead(404).end('Not found'); return; }
    const type = types[path.extname(target).toLowerCase()] || 'application/octet-stream';
    let start = 0, end = stat.size - 1;
    if (request.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
      if (!match) { response.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }).end(); return; }
      start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end;
      if (start > end || start >= stat.size) { response.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }).end(); return; }
      response.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    } else response.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = fs.createReadStream(target, { start, end });
    stream.on('error', () => response.destroy()); stream.pipe(response);
  });
}).listen(port, '127.0.0.1', () => console.log(`YueHai助手: http://127.0.0.1:${port}`));
