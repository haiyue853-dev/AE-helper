(function () {
  'use strict';
  var isCep = !!(window.cep && window.cep.fs);
  var mediaUrls = [];
  function fromBrowser(files) {
    if (!files.length) return null;
    var firstPath = files[0].webkitRelativePath || files[0].name;
    var root = firstPath.indexOf('/') >= 0 ? firstPath.split('/')[0] : '导入的素材';
    var ownedUrls = [];
    var records = Array.prototype.map.call(files, function (file) {
      var path = file.webkitRelativePath || file.name;
      var cachedUrl;
      return {
        name: file.name,
        relativePath: file.webkitRelativePath ? path.slice(root.length + 1) : path,
        size: file.size,
        modified: file.lastModified,
        url: function () {
          if (!cachedUrl) { cachedUrl = URL.createObjectURL(file); ownedUrls.push(cachedUrl); mediaUrls.push(cachedUrl); }
          return cachedUrl;
        }
      };
    });
    return { id: 'browser-' + Date.now(), name: root, records: records, release: function () {
      ownedUrls.forEach(function (url) { URL.revokeObjectURL(url); var i = mediaUrls.indexOf(url); if (i >= 0) mediaUrls.splice(i, 1); });
    } };
  }
  function fileUrl(path) {
    var clean = String(path).replace(/\\/g, '/');
    return (clean.charAt(0) === '/' ? 'file://' : 'file:///') + clean.split('/').map(function (part, index) {
      return index === 0 && /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part);
    }).join('/');
  }
  function readCepFolder(root) {
    return new Promise(function (resolve, reject) {
      var fs = window.cep.fs;
      var records = [];
      var queue = [{ path: root, relative: '', depth: 0 }];
      var issues = 0;
      function step() {
        var current = queue.shift();
        if (!current) {
          var metadata = null;
          try { var saved = fs.readFile(root.replace(/[\\/]$/, '') + '/.yuehai-preview.json'); if (saved && !saved.err) metadata = JSON.parse(saved.data); } catch (ignore) {}
          if (metadata && metadata.version === 1 && metadata.jobs) {
            var mediaStatuses = {};
            Object.keys(metadata.jobs).forEach(function (relative) { mediaStatuses[relative.replace(/\.ffx$/i, '').toLowerCase()] = metadata.jobs[relative].status; });
            records = records.filter(function (file) {
              if (!/\.(mp4|png)$/i.test(file.name)) return true;
              var key = file.relativePath.replace(/\.(mp4|png)$/i, '').toLowerCase(), status = mediaStatuses[key];
              return !status || status === 'success';
            });
          }
          resolve({ id: 'cep:' + root, path: root, name: metadata ? metadata.sourceName : root.replace(/\\/g, '/').split('/').pop(), records: records, issues: issues,
            generated: !!metadata, sourceRoot:metadata&&metadata.sourceRoot, prefix: metadata && metadata.prefix || '', portrait: metadata && !!metadata.portrait,
            failures: metadata && metadata.failures, pending: metadata && metadata.pending, description: metadata && metadata.description, release: function () {} });
          return;
        }
        var listing = fs.readdir(current.path);
        if (!listing || listing.err) {
          if (!current.relative) { reject(new Error('无法读取文件夹，请检查路径和读取权限。')); return; }
          issues++;
        } else {
          listing.data.forEach(function (name) {
            if (name.charAt(0) === '.' || ['node_modules', '$RECYCLE.BIN', 'System Volume Information'].indexOf(name) >= 0) return;
            var absolute = current.path.replace(/[\\/]$/, '') + '/' + name;
            var relative = current.relative ? current.relative + '/' + name : name;
            var stat = fs.stat(absolute);
            if (!stat || stat.err || !stat.data) { issues++; return; }
            var data = stat.data;
            var directory = typeof data.isDirectory === 'function' ? data.isDirectory() : data.isDirectory;
            if (directory) {
              if (current.depth < 16) queue.push({ path: absolute, relative: relative, depth: current.depth + 1 });
              else issues++;
            } else {
              records.push({ name: name, relativePath: relative, size: data.size || 0, modified: Number(data.mtime) || 0, url: function () { return fileUrl(absolute); } });
            }
          });
        }
        setTimeout(step, 0);
      }
      step();
    });
  }
  function chooseCepFolder() {
    return new Promise(function (resolve, reject) {
      if (window.__adobe_cep__ && window.__adobe_cep__.evalScript) {
        window.__adobe_cep__.evalScript('(function(){var d=Folder.selectDialog("选择素材文件夹");return d?d.fsName:"__CANCEL__";})()', function (path) {
          if (!path || path === '__CANCEL__') { resolve(null); return; }
          if (path === 'EvalScript error.' || path === 'undefined') { reject(new Error('AE 文件夹选择器未能打开。')); return; }
          readCepFolder(path).then(resolve, reject);
        });
      } else {
        var result = window.cep.fs.showOpenDialog(false, true, '选择素材文件夹');
        if (!result || result.err || !result.data || !result.data.length) { resolve(null); return; }
        readCepFolder(result.data[0]).then(resolve, reject);
      }
    });
  }
  window.addEventListener('beforeunload', function () { mediaUrls.forEach(function (url) { URL.revokeObjectURL(url); }); });
  function evalScript(script) {
    return new Promise(function (resolve, reject) {
      if (!isCep || !window.__adobe_cep__) { reject(new Error('请在 AE 的 YueHai助手面板中生成预览。')); return; }
      window.__adobe_cep__.evalScript(script, function (result) { if (result === 'EvalScript error.') reject(new Error('AE 脚本执行失败，请查看 AE 的提示。')); else resolve(result); });
    });
  }
  function choosePreviewPath(kind, initial) {
    var script = kind === 'image' ? '(function(){var f=File.openDialog("选择预览图片","图片:*.jpg;*.jpeg;*.png;*.bmp;*.tif;*.tiff");return f?f.fsName:"";}())'
      : '(function(){var f=Folder.selectDialog(' + JSON.stringify(kind === 'output' ? '选择预览输出文件夹' : '选择 FFX 预设文件夹') + (initial ? ',new Folder(' + JSON.stringify(initial) + ')' : '') + ');return f?f.fsName:"";}())';
    return evalScript(script);
  }
  function extensionPath() {
    var value = window.__adobe_cep__ && window.__adobe_cep__.getSystemPath ? window.__adobe_cep__.getSystemPath('extension') : decodeURI(window.location.pathname).replace(/\/[^/]*$/, '');
    try { value = decodeURI(value); } catch (ignore) {}
    return value.replace(/^file:\/\/\//, '').replace(/^\/([A-Za-z]:)/, '$1').replace(/\\/g, '/');
  }
  function generationBackend() {
    var nodeRequire = window.cep_node && window.cep_node.require || (typeof require === 'function' && require);
    if (!nodeRequire) throw new Error('AE 面板的 Node 文件接口不可用，请重新打开面板。');
    var file=extensionPath() + '/js/preview-generation.cjs';
    if(nodeRequire.cache&&nodeRequire.resolve)delete nodeRequire.cache[nodeRequire.resolve(file)];
    return nodeRequire(file);
  }
  function catalogLibrary(data, browser) {
    if(!data)return null;
    data.records.forEach(function(record){record.url=function(){return browser?'/__yuehai/media?file='+encodeURIComponent(record.filePath):fileUrl(record.filePath);};});
    data.release=function(){};return data;
  }
  function catalogRequest(cached) {
    return fetch('/__yuehai/library'+(cached?'?cached=1':''),{method:cached?'GET':'POST',headers:{'X-YueHai-Request':'1'}}).then(function(response){return response.json().then(function(data){if(!response.ok)throw Error(data.error||'刷新预设目录失败。');return catalogLibrary(data,true);});});
  }
  function cachedLibrary(){
    if(!isCep)return catalogRequest(true).catch(function(){return null;});
    try{var r=window.cep_node&&window.cep_node.require||(typeof require==='function'&&require),file=r('path').join(generationBackend().defaults().storageRoot,'.yuehai-library.json');return Promise.resolve(catalogLibrary(JSON.parse(r('fs').readFileSync(file,'utf8')),false));}catch(ignore){return Promise.resolve(null);}
  }
  function refreshLibrary(options){
    if(!isCep)return catalogRequest(false);
    return window.YueHaiHost.defaultPresetRoot().then(function(root){var r=window.cep_node&&window.cep_node.require||(typeof require==='function'&&require);return catalogLibrary(r(extensionPath()+'/js/preset-library.cjs').refresh(root,{storageRoot:generationBackend().defaults().storageRoot,generatedPaths:options&&options.generatedPaths}),false);});
  }
  function referenceVideo(url) {
    return new Promise(function(resolve,reject){var video=document.createElement('video');video.muted=true;video.preload='auto';
      video.onerror=function(){reject(new Error('无法读取粒子参考视频。'));};
      video.onloadeddata=function(){video.onloadeddata=null;resolve({
        pixelsAt:function(time){return new Promise(function(resolve,reject){function capture(){try{var c=document.createElement('canvas');c.width=96;c.height=96;var cx=c.getContext('2d');cx.drawImage(video,0,0,96,96);resolve(cx.getImageData(0,0,96,96).data);}catch(e){reject(e);}}var t=Math.min(time,Math.max(0,video.duration-.04));if(Math.abs(video.currentTime-t)<.001)capture();else{video.onseeked=capture;video.currentTime=t;}});},
        dispose:function(){video.removeAttribute('src');video.load();}
      });};video.src=url;video.load();
    });
  }
  function createPoster(result) {
    return new Promise(function (resolve, reject) {
      var video = document.createElement('video'), timer, candidates = [], best = null, reference = null;
      video.muted = true; video.preload = 'auto'; video.setAttribute('playsinline','');
      function clean() { clearTimeout(timer); video.removeAttribute('src'); video.load(); if(reference)reference.dispose(); }
      function fail(message) { clean(); reject(new Error(message)); }
      function sample() {
        var canvas = document.createElement('canvas'), scale = Math.min(1,512/Math.max(video.videoWidth,video.videoHeight));
        canvas.width = Math.max(1,Math.round(video.videoWidth*scale)); canvas.height = Math.max(1,Math.round(video.videoHeight*scale)); canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
        var small = document.createElement('canvas'); small.width = 96; small.height = 96; var cx = small.getContext('2d'); cx.drawImage(video,0,0,96,96);
        var pixels = cx.getImageData(0,0,96,96).data;
        (reference?reference.pixelsAt(video.currentTime):Promise.resolve(null)).then(function(refPixels){
          var sum=0,square=0,changes=0;
          for(var i=0;i<pixels.length;i+=4){var v=(pixels[i]+pixels[i+1]+pixels[i+2])/3;sum+=v;square+=v*v;if(refPixels&&Math.max(Math.abs(refPixels[i]-pixels[i]),Math.abs(refPixels[i+1]-pixels[i+1]),Math.abs(refPixels[i+2]-pixels[i+2]))>24)changes++;}
          var mean=sum/(96*96),deviation=Math.sqrt(Math.max(0,square/(96*96)-mean*mean)),score=reference?changes:deviation;
          if(!best||score>best.score)best={score:score,mean:mean,deviation:deviation,png:canvas.toDataURL('image/png').split(',')[1]};next();
        },function(e){fail(e.message);});
      }
      function next() {
        if(!candidates.length){
          if(!best||best.deviation<.8||best.mean<1)return fail('渲染结果为空白或纯色，未收录为有效预览。');
          if(reference&&best.score<4)return fail('Particular 没有生成可见粒子，未收录底图或渐变色预览。');
          var nodeRequire = window.cep_node && window.cep_node.require || require, BufferType = nodeRequire('buffer').Buffer;
          clean();resolve(BufferType.from(best.png,'base64'));return;
        }
        var time=candidates.shift();if(Math.abs(video.currentTime-time)<.001&&video.readyState>=2)sample();else video.currentTime=time;
      }
      video.onseeked=sample; video.onerror=function(){fail('AE 输出的视频无法解码，未收录该预览。');};
      video.onloadeddata=function(){
        video.onloadeddata=null;
        if(video.videoWidth!==result.width||video.videoHeight!==result.height||video.duration+1/24<result.duration||video.duration+1/24<result.keyMax)return fail('输出视频尺寸或时长不完整。');
        var end=Math.max(0,video.duration-.08),key=result.keyMax||0;
        candidates=[0,Math.min(end,.2),Math.min(end,.5),Math.min(end,1),Math.min(end,key*.5),end*.5,end*.8,end];
        (result.reference?referenceVideo(fileUrl(result.reference)):Promise.resolve(null)).then(function(p){reference=p;next();},function(e){fail(e.message);});
      };
      timer=setTimeout(function(){fail('视频校验超时，可再次生成该预设。');},45000);video.src=fileUrl(result.file);video.load();
    });
  }
  function startGeneration(options, callbacks) {
    var backend = generationBackend(), prepared = backend.prepare(options), run = new backend.Run(prepared, {progress: callbacks.progress, error: callbacks.error, poster: createPoster,
      library: function (output, activate) { return readCepFolder(output).then(function (library) { callbacks.library(library, activate); }); }});
    return readCepFolder(prepared.output).then(function (library) {
      callbacks.library(library, true);
      return evalScript('Folder.startup.fsName+"/AfterFX.exe";').then(function(executable){
        run.start();
        backend.launchWorkers(prepared,executable,extensionPath()+'/jsx/preview-engine.jsx').catch(function(error){run.abort(error);});
        return run;
      });
    });
  }
  function resumeGeneration(output, callbacks) {
    var backend = generationBackend(), prepared = backend.resume(output);if(!prepared)return Promise.resolve(null);
    var run = new backend.Run(prepared,{progress:callbacks.progress,error:callbacks.error,poster:createPoster,library:function(path,activate){return readCepFolder(path).then(function(lib){callbacks.library(lib,activate);});}}).start();
    evalScript('Folder.startup.fsName+"/AfterFX.exe";').then(function (executable) {
      if(!run.closed)backend.launchWorkers(prepared,executable,extensionPath()+'/jsx/preview-engine.jsx').catch(function(error){run.abort(error);});
    }).catch(function(error){run.abort(error);});
    return Promise.resolve(run);
  }
  var isPreviewWorker=false;
  try { var workerRequire=window.cep_node&&window.cep_node.require;isPreviewWorker=!!workerRequire&&workerRequire('process').env.YUEHAI_PREVIEW_WORKER==='1'; } catch(ignore) {}
  function subtitleBackend(){var nodeRequire=window.cep_node&&window.cep_node.require||(typeof require==='function'&&require);if(!isCep||!nodeRequire)throw Error('请在 AE 的 YueHai助手面板使用本地字幕。');return nodeRequire(extensionPath()+'/js/subtitle-jobs.cjs');}
  function importSubtitles(directory,cues,mode){var file=subtitleBackend().importConfig(directory,cues,mode);return evalScript('$.evalFile(new File('+JSON.stringify(extensionPath()+'/jsx/subtitles.jsx')+'));$.evalFile(new File('+JSON.stringify(file.replace(/\\/g,'/'))+'));YueHaiSubtitles.importCues(YUEHAI_SUBTITLES);').then(function(value){var result=JSON.parse(value);if(!result.ok)throw Error(result.error);return result;});}
  function templateCall(method,arg){if(!isCep)return Promise.reject(Error('请在 AE 面板读取和替换工程模板。'));return evalScript('$.evalFile(new File('+JSON.stringify(extensionPath()+'/jsx/template-engine.jsx')+'));YueHaiTemplates.'+method+'('+(arg===undefined?'':JSON.stringify(arg))+');').then(function(value){var result=JSON.parse(value);if(!result.ok)throw Error(result.error);return result;});}
  function templateBackend(){var r=window.cep_node&&window.cep_node.require||(typeof require==='function'&&require);if(!isCep||!r)throw Error('请在 AE 面板使用套模板。');return r(extensionPath()+'/js/template-bridge.cjs');}
  window.YueHaiHost = { isCep: isCep, isPreviewWorker:isPreviewWorker, fromBrowser: fromBrowser, chooseCepFolder: chooseCepFolder, readCepFolder: readCepFolder,
    cachedLibrary:cachedLibrary,refreshLibrary:refreshLibrary,
    addAdjustmentLayer:function(){return evalScript('$.evalFile(new File('+JSON.stringify(extensionPath()+'/jsx/preset-apply.jsx')+'));YueHaiPresets.addAdjustment();').then(function(value){var result=JSON.parse(value);if(!result.ok)throw Error(result.error);return result;});},
    calibratePresetCenters:function(){return evalScript('$.evalFile(new File('+JSON.stringify(extensionPath()+'/jsx/preset-apply.jsx')+'));YueHaiPresets.calibrate();').then(function(value){var result=JSON.parse(value);if(!result.ok)throw Error(result.error);return result;});},
    applyPreset:function(url,options){if(!isCep)return Promise.reject(Error('请在 AE 面板选中图层后应用预设。'));var link=document.createElement('a');link.href=url;if(link.protocol!=='file:')return Promise.reject(Error('这个预设没有可读取的本地 FFX 文件。'));var file=decodeURIComponent(link.pathname);if(/^\/[A-Za-z]:/.test(file))file=file.slice(1);return evalScript('$.evalFile(new File('+JSON.stringify(extensionPath()+'/jsx/preset-apply.jsx')+'));YueHaiPresets.apply('+JSON.stringify(file)+','+JSON.stringify({calibrateCenters:!!(options&&options.calibrateCenters)})+');').then(function(value){var result=JSON.parse(value);if(!result.ok)throw Error(result.error);return result;});},
    templateComps:function(){return templateCall('list');},scanTemplate:function(id){return templateCall('scan',id);},
    chooseTemplateMedia:function(multiple){return templateCall('chooseMedia',!!multiple).then(function(result){return result.files;});},
    templateMediaUrl:fileUrl,
    templatePreview:function(file,progress){return templateBackend().preview(file,progress).then(fileUrl);},
    applyTemplate:function(config){var file=templateBackend().payload(config);return evalScript('$.evalFile(new File('+JSON.stringify(extensionPath()+'/jsx/template-engine.jsx')+'));$.evalFile(new File('+JSON.stringify(file.replace(/\\/g,'/'))+'));YueHaiTemplates.apply(YUEHAI_TEMPLATE_CONFIG);').then(function(value){var result=JSON.parse(value);if(!result.ok)throw Error(result.error);return result;});},
    chooseSubtitleVideo:function(){return evalScript('(function(){var f=File.openDialog("选择识别字幕的视频或音频","音视频:*.mp4;*.mov;*.mkv;*.avi;*.webm;*.m4v;*.mxf;*.mts;*.wmv;*.mp3;*.wav;*.m4a;*.aac;*.flac;*.ogg");return f?f.fsName:"";}());');},
    selectedSubtitleLayer:function(){if(!isCep)return Promise.reject(Error('请在 AE 面板读取选中的图层。'));return evalScript('$.evalFile(new File('+JSON.stringify(extensionPath()+'/jsx/subtitles.jsx')+'));YueHaiSubtitles.readSelection();').then(function(value){var result=JSON.parse(value);if(!result.ok)throw Error(result.error);return result.sourceLayer;});},
    subtitleStatus:function(){return subtitleBackend().status();},
    startSubtitles:function(options,callbacks){return subtitleBackend().start(options,callbacks);},
    resumeSubtitles:function(directory,callbacks){return subtitleBackend().resume(directory,callbacks);},
    saveSubtitles:function(directory,cues){return subtitleBackend().save(directory,cues);},
    openSubtitleFolder:function(directory){return subtitleBackend().openFolder(directory);},
    importSubtitles:importSubtitles,
    choosePreviewPath: choosePreviewPath, startGeneration: startGeneration, resumeGeneration: resumeGeneration,
    defaultPreviewOutput:function(source,base){return generationBackend().defaultOutput(source,base);},
    defaultPreviewImage:function(){return generationBackend().defaults().defaultImage||'';},
    defaultPresetRoot: function () { return evalScript('Folder.startup.fsName+"/Presets";'); } };
}());
