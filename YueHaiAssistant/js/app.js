(function () {
  'use strict';
  var model = window.YueHaiModel;
  var host = window.YueHaiHost;
  var settings;
  try { settings = JSON.parse(localStorage.getItem('yuehai.preview.v1') || '{}'); } catch (error) { settings = {}; }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) settings = {};
  var state = { libraries: [], current: null, folder: '', query: '', type: 'all', sort: 'default', favoritesOnly: false, previewStatus:'all',
    favorites: settings.favorites && typeof settings.favorites === 'object' ? settings.favorites : {},
    zoom: Math.min(330, Math.max(100, settings.compactLayout ? Number(settings.zoom) || 140 : (window.innerWidth < 480 ? 100 : 140))),
    playing: null, modal: false, focusReturn: null, busy: false, toastTimer: null,calibrateCenters:!!settings.calibrateCenters,
    generatedPaths: Array.isArray(settings.generatedPaths) ? settings.generatedPaths : [] };
  var kinds = { preset: 'FFX 预设', project: 'AEP 工程', video: '视频', image: '图片', audio: '音频' };
  var els = {};
  document.addEventListener('DOMContentLoaded', init);

  function icon(name, className) { return '<svg class="icon ' + (className || '') + '" aria-hidden="true"><use href="#i-' + name + '" xlink:href="#i-' + name + '"/></svg>'; }
  function escape(value) { return String(value).replace(/[&<>"']/g, function (char) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]; }); }
  function getFavorites(library) { return state.favorites[(library || state.current).id] || {}; }
  function saveSettings() {
    try { localStorage.setItem('yuehai.preview.v1', JSON.stringify({ zoom: state.zoom, compactLayout: true, presetFoldersMerged: true, favorites: state.favorites,calibrateCenters:state.calibrateCenters,
      generatedPaths: state.generatedPaths, cepPaths: state.libraries.filter(function (library) { return !!library.path; }).map(function (library) { return library.path; }) })); } catch (error) {}
  }
  function init() {
    if (host.isCep) document.body.classList.add('cep-panel');
    ['addAdjustmentLayer','refreshPresets','previewStatus','fillMissingPreviews','retryFailedPreviews','libraryList', 'librarySelect', 'libraryTitle', 'libraryDescription', 'totalBadge', 'favoriteBadge', 'assetGrid',
      'searchInput', 'favoriteToggle', 'sortSelect', 'allNav', 'favoritesNav', 'allTypeCount', 'resultCount', 'emptyState', 'emptyTitle', 'emptyDescription',
      'resetFilters', 'zoomRange', 'hostLabel', 'folderInput', 'previewOverlay', 'previewStage', 'previewTitle', 'previewDetail', 'previewApply','calibratePresetCenters','calibrateSelectedCenters','previewCalibrationLabel','previewCalibrateCenters', 'closePreview', 'toast'].forEach(function (id) { els[id] = document.getElementById(id); });
    els.calibrateSelectedCenters.disabled=!host.isCep;els.calibratePresetCenters.disabled=!host.isCep;els.previewCalibrateCenters.disabled=!host.isCep;els.calibratePresetCenters.checked=els.previewCalibrateCenters.checked=state.calibrateCenters;
    els.addAdjustmentLayer.disabled=!host.isCep;
    els.addAdjustmentLayer.addEventListener('click',function(){if(state.applyingPreset)return;state.applyingPreset=true;els.addAdjustmentLayer.disabled=true;
      Promise.resolve().then(function(){return host.addAdjustmentLayer();}).then(function(result){toast('已添加 '+result.count+' 个等长调整图层，并选中新图层。可在 AE 中撤销。');},function(error){toast(error.message||'添加调整图层失败。',true);}).then(function(){state.applyingPreset=false;els.addAdjustmentLayer.disabled=!host.isCep;});
    });
    [els.calibratePresetCenters,els.previewCalibrateCenters].forEach(function(input){input.addEventListener('change',function(){state.calibrateCenters=this.checked;els.calibratePresetCenters.checked=els.previewCalibrateCenters.checked=this.checked;saveSettings();});});
    els.calibrateSelectedCenters.addEventListener('click',function(){if(state.applyingPreset)return;var button=els.calibrateSelectedCenters;state.applyingPreset=true;button.disabled=true;Promise.resolve().then(function(){return host.calibratePresetCenters();}).then(function(result){toast((result.points?'已校准 '+result.count+' 个图层中的 '+result.points+' 个效果中心点':result.found?'效果中心已对齐，未重复移动':'没有找到可校准的效果中心点')+(result.skipped?'；'+result.skipped+' 个表达式控制或不可写的点已跳过':'。'),!!result.skipped);},function(error){toast(error.message||'中心校准失败。',true);}).then(function(){state.applyingPreset=false;button.disabled=!host.isCep;});});
    Array.prototype.forEach.call(document.querySelectorAll('.add-library'), function (button) { button.addEventListener('click', chooseFolder); });
    document.getElementById('brandHome').addEventListener('click', function () { switchLibrary('yuehai-my-presets'); });
    document.getElementById('brandMobile').addEventListener('click', function () { switchLibrary('yuehai-my-presets'); });
    els.folderInput.addEventListener('change', function () {
      var library = host.fromBrowser(els.folderInput.files);
      if (library) { addLibrary(library); toast('已导入 ' + library.name + '。浏览器素材在当前页面内可用。'); }
      els.folderInput.value = '';
    });
    els.searchInput.addEventListener('input', function () { state.query = this.value; renderAssets(); });
    els.previewStatus.addEventListener('change',function(){state.previewStatus=this.value;renderAssets();});
    els.refreshPresets.addEventListener('click',function(){refreshPresets(false);});
    els.fillMissingPreviews.addEventListener('click',function(){requestPreview('missing');});
    els.retryFailedPreviews.addEventListener('click',function(){requestPreview('failed');});
    els.sortSelect.addEventListener('change', function () { state.sort = this.value; renderAssets(); });
    els.favoriteToggle.addEventListener('click', function () { state.favoritesOnly = !state.favoritesOnly; render(); });
    els.allNav.addEventListener('click', function () { resetView(false); });
    els.favoritesNav.addEventListener('click', function () { resetView(true); });
    els.resetFilters.addEventListener('click', function () { resetView(false); });
    els.librarySelect.addEventListener('change', function () {
      var destination = this.value.charAt(0) === '[' ? JSON.parse(this.value) : [this.value, ''];
      switchLibrary(destination[0], destination[1]);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.type-chip'), function (button) {
      button.addEventListener('click', function () { state.type = button.getAttribute('data-type'); renderAssets(); });
    });
    els.zoomRange.value = state.zoom;
    applyZoom();
    window.addEventListener('resize', applyZoom);
    els.zoomRange.addEventListener('input', function () { state.zoom = Number(this.value); applyZoom(); saveSettings(); });
    els.closePreview.addEventListener('click', closePreview);
    els.previewOverlay.addEventListener('click', function (event) { if (event.target === els.previewOverlay) closePreview(); });
    els.previewApply.addEventListener('click',function(event){if(event.detail<2&&state.previewItem)applyPreset(state.previewItem,els.previewApply);});
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('visibilitychange', function () { if (document.hidden) pauseAll(false); });
    window.addEventListener('beforeunload', function () { pauseAll(false); });
    els.hostLabel.textContent = host.isCep ? 'AE 面板 · 本地素材' : '浏览器预览';
    var presetSources = [
      {library: window.YueHaiMyPresets, prefix: ''},
      {library: window.YueHaiLiliPresets, prefix: 'LILI转场'},
      {library: window.YueHaiColor2Presets, prefix: '调色2'}
    ];
    if (!settings.presetFoldersMerged) presetSources.forEach(function (source) {
      if (!source.library || !source.prefix) return;
      var oldFavorites = state.favorites[source.library.id] || {};
      var favorites = state.favorites['yuehai-my-presets'] || (state.favorites['yuehai-my-presets'] = {});
      Object.keys(oldFavorites).forEach(function (id) { if (oldFavorites[id]) favorites[source.prefix + '/' + id.replace(/^\//, '')] = true; });
    });
    addLibrary(model.combinePresetLibraries(presetSources));
    if(host.cachedLibrary)host.cachedLibrary().then(function(library){if(library&&!state.catalogRefreshed)applyCatalog(library);},function(){});
    if (host.isCep && Array.isArray(settings.cepPaths)) {
      settings.cepPaths.forEach(function (path) {
        if (typeof path !== 'string') return;
        host.readCepFolder(path).then(function (library) { addLibrary(library, false); }, function () { toast('素材库暂时无法读取：' + path, true); });
      });
    }
    document.addEventListener('yuehai:preview-library', function (event) {
      var library = event.detail.library;
      if (library.path && state.generatedPaths.indexOf(library.path) === -1) state.generatedPaths.push(library.path);
      mergeGenerated(library, event.detail.activate);
    });
    document.addEventListener('yuehai:preview-context', function (event) { event.detail.folder = state.current.id === 'yuehai-my-presets' ? state.folder : '';event.detail.sourceRoot=state.current.sourceRoot||state.current.path||''; });
    if (host.isCep) state.generatedPaths.forEach(function (path) { host.readCepFolder(path).then(function (library) { mergeGenerated(library, false); }, function () {}); });
  }
  function mergeGenerated(library, activate) {
    if (!library.generated) return;
    var base = state.libraries.filter(function (entry) { return entry.id === 'yuehai-my-presets'; })[0];
    if(base.live&&host.refreshLibrary){refreshPresets(true,activate?library.prefix:undefined);return;}
    model.mergeGeneratedLibrary(base, library);base.items = model.groupFiles(base.records);
    if (activate) switchLibrary(base.id, library.prefix);
    else render();
    saveSettings();
  }
  function applyCatalog(library,folder){
    library.items=model.groupFiles(library.records);
    var index=state.libraries.findIndex(function(entry){return entry.id===library.id;}),old=state.libraries[index];
    if(index<0)state.libraries.push(library);else state.libraries[index]=library;
    if(state.current&&state.current.id===library.id){state.current=library;if(typeof folder==='string')state.folder=folder;
      var paths=model.getAllFolders(library.items,library.folders).map(function(entry){return entry.path;});
      while(state.folder&&paths.indexOf(state.folder)===-1)state.folder=state.folder.indexOf('/')>=0?state.folder.slice(0,state.folder.lastIndexOf('/')):'';
      if(!state.folder&&paths.length)state.folder=paths[0];
    }
    if(old&&old.release)old.release();render();saveSettings();
  }
  function refreshPresets(silent,folder){
    if(state.refreshing)return Promise.resolve();state.refreshing=true;els.refreshPresets.disabled=true;els.refreshPresets.textContent='刷新中…';
    return Promise.resolve().then(function(){if(!host.refreshLibrary)throw Error('请重新打开面板后再刷新。');return host.refreshLibrary({generatedPaths:state.generatedPaths});}).then(function(library){
      state.catalogRefreshed=true;applyCatalog(library,folder);
      if(!silent)toast('已刷新 '+library.items.length+' 个预设，收藏已保留。');
      if(!silent&&host.isCep)return Promise.all(state.libraries.filter(function(entry){return !!entry.path&&!entry.generated;}).map(function(entry){return host.readCepFolder(entry.path).then(function(updated){updated.items=model.groupFiles(updated.records);var index=state.libraries.indexOf(entry);if(index>=0){state.libraries[index]=updated;if(state.current===entry)state.current=updated;entry.release();}},function(){toast('未能刷新：'+entry.name+'，已保留原列表。',true);});})).then(function(){render();});
    }).catch(function(error){if(!silent)toast(error.message||'刷新失败，已保留原列表。',true);}).then(function(){state.refreshing=false;els.refreshPresets.disabled=false;els.refreshPresets.textContent='刷新预设';});
  }
  function previewCandidates(library){return model.selectItems(library.items,{folder:state.query.trim()||state.favoritesOnly?undefined:state.folder,recursive:true,query:state.query,type:state.type,favoritesOnly:state.favoritesOnly,favorites:getFavorites(library)}).filter(function(item){return !!presetFile(item);});}
  function requestPreview(kind,item,library){
    library=library||state.current;
    var items=item?[item]:previewCandidates(library).filter(function(entry){return model.previewStatus(entry,library)===kind;});
    if(!items.length){toast('当前范围没有需要'+(kind==='failed'?'重试':'补齐')+'的预览。');return;}
    document.dispatchEvent(new CustomEvent('yuehai:request-preview',{detail:{sourceRoot:library.sourceRoot||library.path||'',relativePaths:items.map(function(entry){return presetFile(entry).relativePath||presetFile(entry).name;}),kind:kind,reuse:false}}));
  }
  function applyZoom() {
    var available = els.assetGrid.clientWidth || window.innerWidth - 32;
    document.documentElement.style.setProperty('--card-min', Math.min(available, state.zoom) + 'px');
  }
  function addLibrary(library, activate) {
    library.items = model.groupFiles(library.records);
    var existing = state.libraries.filter(function (entry) { return entry.id === library.id; })[0];
    if (existing) { existing.release(); state.libraries.splice(state.libraries.indexOf(existing), 1); }
    state.libraries.push(library);
    if (!state.current || activate !== false) switchLibrary(library.id);
    else { renderLibraries(); renderAssets(); }
    saveSettings();
    if (library.issues) toast('已读取素材，有 ' + library.issues + ' 个目录或文件未能读取。', true);
  }
  function switchLibrary(id, folder) {
    var library = state.libraries.filter(function (entry) { return entry.id === id; })[0];
    if (!library) return;
    closePreview();
    state.current = library;
    var firstFolder = library.builtin && typeof folder !== 'string' ? model.getAllFolders(library.items)[0] : null;
    state.folder = typeof folder === 'string' ? folder : (firstFolder ? firstFolder.path : ''); state.query = ''; state.type = 'all'; state.favoritesOnly = false;state.previewStatus='all';els.previewStatus.value='all';
    els.searchInput.value = '';
    render();
  }
  function removeLibrary(library) {
    if (library.builtin) return;
    if (state.current.id === library.id) switchLibrary('yuehai-my-presets');
    library.release();
    state.libraries.splice(state.libraries.indexOf(library), 1);
    delete state.favorites[library.id];
    renderLibraries(); saveSettings();
    toast('已从素材库移除，磁盘文件保持原样。');
  }
  function resetView(favoritesOnly) {
    state.query = ''; state.type = 'all'; state.favoritesOnly = favoritesOnly;state.previewStatus='all';els.previewStatus.value='all';
    els.searchInput.value = ''; render();
  }
  function renderLibraries() {
    els.libraryList.textContent = ''; els.librarySelect.textContent = '';
    state.libraries.forEach(function (library) {
      var entry = document.createElement('div'); entry.className = 'library-entry' + (state.current.id === library.id ? ' selected' : '');
      var button = document.createElement('button'); button.type = 'button'; button.className = 'library-link';
      button.innerHTML = icon(library.demo ? 'spark' : 'folder') + '<span>' + escape(library.name) + '</span>';
      button.title = library.path || library.name;
      button.addEventListener('click', function () { switchLibrary(library.id); }); entry.appendChild(button);
      if (!library.builtin) {
        var remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button remove-library';
        remove.innerHTML = icon('close'); remove.setAttribute('aria-label', '移除素材库 ' + library.name);
        remove.addEventListener('click', function () { removeLibrary(library); }); entry.appendChild(remove);
      }
      els.libraryList.appendChild(entry);
      if (!library.builtin) {
        var option = document.createElement('option'); option.value = library.id; option.textContent = library.name; els.librarySelect.appendChild(option);
      }
      model.getAllFolders(library.items,library.folders).forEach(function (folder) {
        var option = document.createElement('option'); option.value = JSON.stringify([library.id, folder.path]);
        option.textContent = (library.builtin ? '' : library.name + ' / ') + folder.path.replace(/\//g, ' / ');
        els.librarySelect.appendChild(option);
      });
    });
    els.librarySelect.value = state.folder ? JSON.stringify([state.current.id, state.folder]) : state.current.id;
  }
  function render() {
    renderLibraries();
    els.totalBadge.textContent = state.current.items.length;
    renderAssets();
  }
  function renderAssets() {
    pauseAll(true);
    var favorites = getFavorites();
    var searching = !!state.query.trim();
    els.libraryTitle.textContent = searching ? '全局搜索' : state.folder ? state.folder.split('/').pop() : state.current.name;
    var dot = document.createElement('span'); dot.className = 'title-dot'; dot.textContent = '.'; els.libraryTitle.appendChild(dot);
    els.libraryDescription.textContent = searching ? '搜索所有文件夹 · 点击结果定位，双击放大预览' : state.current.description || (state.current.demo ? '让灵感先动起来，再开始创作。' : '你的素材，你的创作节奏。');
    var options = { folder: searching || state.favoritesOnly ? undefined : state.folder, recursive: true, query: state.query, type: state.type, sort: state.sort,
      favoritesOnly: state.favoritesOnly, favorites: favorites,previewStatus:state.previewStatus };
    var selected = [];
    (searching ? state.libraries : [state.current]).forEach(function (library) {
      options.favorites = getFavorites(library);
      options.library=library;
      model.selectItems(library.items, options).forEach(function (item) { selected.push({item: item, library: library}); });
    });
    if (searching && state.sort !== 'default') selected.sort(function (a, b) {
      if (state.sort === 'recent') return b.item.modified - a.item.modified || a.item.name.localeCompare(b.item.name);
      var compared = a.item.name.localeCompare(b.item.name, 'zh-CN', {numeric: true, sensitivity: 'base'});
      return state.sort === 'desc' ? -compared : compared;
    });
    els.favoriteBadge.textContent = state.current.items.filter(function (item) { return !!favorites[item.id]; }).length;
    els.allNav.classList.toggle('active', !state.favoritesOnly);
    els.favoritesNav.classList.toggle('active', state.favoritesOnly);
    els.favoriteToggle.setAttribute('aria-pressed', String(state.favoritesOnly));
    Array.prototype.forEach.call(document.querySelectorAll('.type-chip'), function (button) { button.classList.toggle('active', button.getAttribute('data-type') === state.type); });
    els.allTypeCount.textContent = searching ? state.libraries.reduce(function (count, library) { return count + model.selectItems(library.items, {query: state.query}).length; }, 0) : model.selectItems(state.current.items, {folder: state.folder, recursive: true}).length;
    els.resultCount.textContent = (searching ? '全局 · ' : '') + selected.length + ' 个素材';
    var candidates=previewCandidates(state.current),missing=candidates.filter(function(item){return model.previewStatus(item,state.current)==='missing';}).length,failed=candidates.filter(function(item){return model.previewStatus(item,state.current)==='failed';}).length;
    els.fillMissingPreviews.textContent='补齐缺失'+(missing?' '+missing:'');els.retryFailedPreviews.textContent='重试失败'+(failed?' '+failed:'');
    els.fillMissingPreviews.disabled=!host.isCep||!missing;els.retryFailedPreviews.disabled=!host.isCep||!failed;
    els.fillMissingPreviews.title=els.retryFailedPreviews.title=host.isCep?'处理当前文件夹及子文件夹，搜索时处理当前素材库内的匹配结果':'请在 AE 面板生成预览';
    els.assetGrid.textContent = '';
    var fragment = document.createDocumentFragment();
    selected.forEach(function (entry) { fragment.appendChild(createCard(entry.item, entry.library, searching)); });
    els.assetGrid.appendChild(fragment);
    els.emptyState.hidden = !!selected.length;
    els.emptyTitle.textContent = state.favoritesOnly ? '收藏你的第一份灵感' : !state.current.items.length ? '这里还没有可预览的素材' : '没有找到素材';
    els.emptyDescription.textContent = state.favoritesOnly ? '点击卡片上的星标，就可以在这里找到它。' : !state.current.items.length ? '支持视频、图片、音频，以及配有预览媒体的 AEP / FFX。' : '换个关键词或筛选条件，让灵感重新出现。';
  }
  function demoEntry(item, library) {
    library = library || state.current;
    return library.demo ? library.entries.filter(function (entry) { return entry.name === item.name; })[0] : null;
  }
  function itemMessage(field, item, library) {
    var messages = (library || state.current)[field];
    return messages && (messages[item.id] || messages[item.name]);
  }
  function itemLayout(item, library) { library = library || state.current; return library.layouts && library.layouts[item.id] || library; }
  function locateSearchItem(item, library) {
    switchLibrary(library.id, item.folder);
    var target = Array.prototype.filter.call(els.assetGrid.children, function (card) { return card.getAttribute('data-item-id') === item.id; })[0];
    if (target) { target.classList.add('search-target'); target.scrollIntoView({block: 'center'}); target.focus({preventScroll: true}); }
    return target;
  }
  function createCard(item, library, searching) {
    var failure = itemMessage('failures', item, library);
    var pending = itemMessage('pending', item, library);
    var layout = itemLayout(item, library);
    var card = document.createElement('article'); card.className = 'asset-card' + (layout.imageOnly ? ' still-preview' : '') + (layout.portrait ? ' portrait-preview' : ''); card.tabIndex = 0; card.setAttribute('data-item-id', item.id);
    card.setAttribute('aria-label', item.name + '，' + kinds[item.kind] + (searching ? '，点击定位所在文件夹' : '') + '，双击或按 Enter 放大预览');
    var demo = demoEntry(item, library);
    var thumb = document.createElement('div'); thumb.className = 'thumbnail';
    if (item.image) {
      var poster = document.createElement('img'); poster.className = 'poster'; poster.alt = ''; poster.loading = 'lazy'; poster.src = item.image.url(); thumb.appendChild(poster);
      poster.addEventListener('error', function () { poster.remove(); thumb.insertAdjacentHTML('afterbegin', '<div class="placeholder-art">' + icon('image') + '</div>'); });
    } else {
      var art = document.createElement('div'); art.className = 'placeholder-art' + (item.audio ? ' audio-art' : '');
      art.innerHTML = icon(item.audio ? 'audio' : item.video ? 'play' : 'file'); thumb.appendChild(art);
      if (!item.video && !item.audio) thumb.insertAdjacentHTML('beforeend', '<span class="placeholder-note">' + escape(failure ? '预览暂未生成 · 双击查看原因' : pending ? '预览制作中' : '点击“生成预览”自动制作') + '</span>');
    }
    thumb.insertAdjacentHTML('beforeend', '<div class="thumb-shade"></div>' + (!demo && item.kind === 'preset' ? '' : '<span class="card-label">' + escape(demo ? demo.label : kinds[item.kind]) + '</span>'));
    var starred = !!getFavorites(library)[item.id];
    var star = document.createElement('button'); star.type = 'button'; star.className = 'icon-button star-button' + (starred ? ' starred' : ''); star.innerHTML = icon('star');
    star.title = starred ? '取消收藏' : '收藏素材'; star.setAttribute('aria-label', (starred ? '取消收藏 ' : '收藏 ') + item.name); star.setAttribute('aria-pressed', String(starred));
    star.addEventListener('click', function (event) {
      event.stopPropagation();
      if (!state.favorites[library.id]) state.favorites[library.id] = {};
      if (getFavorites(library)[item.id]) delete getFavorites(library)[item.id]; else getFavorites(library)[item.id] = true;
      saveSettings(); renderAssets();
    });
    star.addEventListener('dblclick', function (event) { event.stopPropagation(); }); thumb.appendChild(star);
    if(presetFile(item)){var apply=document.createElement('button');apply.type='button';apply.className='preset-apply-button';apply.textContent='应用';apply.title=host.isCep?'将此预设应用到 AE 选中图层（从时间指针开始）':'请在 AE 面板应用预设';apply.setAttribute('aria-label','应用预设 '+item.name);apply.disabled=!host.isCep;apply.addEventListener('click',function(event){event.stopPropagation();if(event.detail<2)applyPreset(item,apply);});apply.addEventListener('dblclick',function(event){event.stopPropagation();});thumb.appendChild(apply);}
    var badges = item.projects.map(function (file) { var ext = model.extension(file.name); return '<span class="format-badge ' + (ext === 'ffx' ? 'preset' : 'project') + '">' + ext.toUpperCase() + '</span>'; }).join('');
    if (!badges) badges = '<span class="format-badge">' + (item.video ? model.extension(item.video.name).toUpperCase() : item.audio ? model.extension(item.audio.name).toUpperCase() : 'IMAGE') + '</span>';
    if (demo) badges = '<span class="format-badge">示例</span>';
    thumb.insertAdjacentHTML('beforeend', '<div class="card-bottom">' + badges + '<span class="duration-badge">' + (demo && !demo.imageOnly ? '00:03' : '') + '</span></div><span class="expand-hint">' + icon('expand') + '双击放大</span>');
    if (item.video || item.audio) thumb.insertAdjacentHTML('beforeend', '<span class="card-play">' + icon('play') + '</span>');
    var copy = document.createElement('div'); copy.className = 'card-info';
    copy.innerHTML = '<div class="card-copy"><h2 class="card-title">' + escape(item.name) + '</h2><p class="card-subtitle">' + escape(failure ? (/更高版本/.test(failure) ? '需要更高版本 AE · 双击查看原因' : '预览未完成 · 双击查看原因') : demo ? demo.description : (item.folder ? item.folder + ' · ' : '') + kinds[item.kind] + (item.projects.length ? ' · ' + (item.video || item.image ? (state.current.imageOnly ? 'PNG 调色预览' : '已关联预览') : '暂无预览') : '')) + '</p></div>' + icon(item.audio ? 'audio' : item.video ? 'play' : item.image ? 'image' : 'file', 'card-type-icon');
    card.appendChild(thumb); card.appendChild(copy);
    if(presetFile(item)){
      var management=document.createElement('div');management.className='card-preview-tools';var previewState=model.previewStatus(item,library);
      var status=document.createElement('span');status.className='card-preview-state '+previewState;status.textContent={ready:'已完成',missing:'缺少预览',failed:'生成失败',pending:'制作中'}[previewState];management.appendChild(status);
      var regenerate=document.createElement('button');regenerate.type='button';regenerate.className='preset-regenerate';regenerate.textContent=previewState==='ready'?'重做预览':previewState==='failed'?'重试预览':'制作预览';regenerate.disabled=!host.isCep||previewState==='pending';
      regenerate.title=host.isCep?'仅制作此预设，可更换底图和时长':'请在 AE 面板制作预览';regenerate.addEventListener('click',function(event){event.stopPropagation();requestPreview('single',item,library);});regenerate.addEventListener('dblclick',function(event){event.stopPropagation();});management.appendChild(regenerate);card.appendChild(management);
    }
    if (searching) {
      var location = document.createElement('button'); location.type = 'button'; location.className = 'search-location';
      location.textContent = (library.builtin ? '' : library.name + (item.folder ? ' / ' : '')) + item.folder || library.name;
      location.title = '打开所在文件夹：' + location.textContent;
      location.addEventListener('click', function (event) { event.stopPropagation(); locateSearchItem(item, library); });
      location.addEventListener('dblclick', function (event) { event.stopPropagation(); }); card.appendChild(location);
    }
    var hoverMedia = null;
    function start() {
      if (!item.video || state.modal || card.__pauseUntilMove) return;
      pauseAll(true);
      if (!hoverMedia) {
        hoverMedia = document.createElement('video'); hoverMedia.className = 'hover-video'; hoverMedia.muted = true; hoverMedia.loop = true;
        hoverMedia.setAttribute('playsinline', ''); hoverMedia.preload = 'none'; hoverMedia.src = item.video.url();
        hoverMedia.addEventListener('playing', function () { card.classList.add('playing'); });
        hoverMedia.addEventListener('loadedmetadata', function () { var badge = thumb.querySelector('.duration-badge'); if (isFinite(hoverMedia.duration)) badge.textContent = formatDuration(hoverMedia.duration); });
        hoverMedia.addEventListener('error', function () {
          card.classList.remove('playing');
          if (!thumb.querySelector('.media-error')) thumb.insertAdjacentHTML('beforeend', '<span class="media-error">此格式暂时无法播放<br>可换用 H.264 MP4 或 WebM</span>');
        });
        thumb.insertBefore(hoverMedia, thumb.querySelector('.thumb-shade'));
      }
      state.playing = hoverMedia;
      var promise = hoverMedia.play();
      if (promise && promise.catch) promise.catch(function () { card.classList.remove('playing'); });
    }
    function stop() {
      card.__pauseUntilMove = false;
      if (hoverMedia) { hoverMedia.pause(); try { hoverMedia.currentTime = 0; } catch (error) {} }
      card.classList.remove('playing');
    }
    card.addEventListener('mouseenter', start); card.addEventListener('mouseleave', stop);
    card.addEventListener('mousemove', function () {
      if (card.__pauseUntilMove && !state.modal) { card.__pauseUntilMove = false; start(); }
    });
    card.addEventListener('focus', start); card.addEventListener('blur', stop);
    var locateTimer;
    function previewFromCard() { clearTimeout(locateTimer); var trigger = searching ? locateSearchItem(item, library) : card; openPreview(item, trigger); }
    card.addEventListener('dblclick', function (event) { if (!event.target.closest('button')) previewFromCard(); });
    card.addEventListener('keydown', function (event) { if (event.target === card && event.key === 'Enter') { event.preventDefault(); previewFromCard(); } });
    card.addEventListener('click', function (event) {
      if (event.target.closest('button')) return;
      if (window.matchMedia('(hover: none)').matches) previewFromCard();
      else if (searching) { clearTimeout(locateTimer); locateTimer = setTimeout(function () {
        if (document.body.contains(card)) locateSearchItem(item, library);
      }, 300); }
    });
    return card;
  }
  function pauseAll(reset) {
    Array.prototype.forEach.call(document.querySelectorAll('video,audio'), function (media) {
      media.pause(); if (reset && !els.previewStage.contains(media)) { try { media.currentTime = 0; } catch (error) {} }
    });
    Array.prototype.forEach.call(document.querySelectorAll('.asset-card.playing'), function (card) { card.classList.remove('playing'); }); state.playing = null;
  }
  function openPreview(item, trigger) {
    pauseAll(true); state.modal = true; state.focusReturn = trigger;
    state.previewItem=item;els.previewApply.hidden=!presetFile(item);els.previewApply.disabled=!host.isCep||!!state.applyingPreset;els.previewApply.title=host.isCep?'从 AE 当前时间指针开始应用':'请在 AE 面板应用预设';
    els.previewCalibrationLabel.hidden=!presetFile(item);
    els.previewOverlay.classList.toggle('portrait-preview', !!itemLayout(item).portrait);
    els.previewTitle.textContent = item.name; els.previewStage.textContent = '';
    els.previewDetail.textContent = kinds[item.kind] + (item.folder ? ' / ' + item.folder : '') + (item.size ? ' · ' + formatSize(item.size) : state.current.demo ? ' · 示例素材' : ' · 本地素材');
    var file = item.video || item.audio || item.image;
    var failure = itemMessage('failures', item) || itemMessage('pending', item);
    var note = itemMessage('notes', item);
    if (note) els.previewDetail.textContent += ' · ' + note;
    if (!file) {
      els.previewStage.innerHTML = '<div class="modal-placeholder">' + icon('file') + (failure ? escape(failure) : '这个预设还没有预览。<br>点击面板上方“生成预览”，选择图片即可自动制作。') + '</div>';
    } else {
      var tag = item.video ? 'video' : item.audio ? 'audio' : 'img';
      var media = document.createElement(tag); media.src = file.url();
      if (tag !== 'img') {
        media.controls = true; media.loop = true; media.volume = .5; media.setAttribute('playsinline', '');
        if (tag === 'video' && item.image) media.poster = item.image.url();
      } else media.alt = item.name;
      media.addEventListener('error', function () {
        if (els.previewStage.querySelector('.modal-error')) return;
        var error = document.createElement('p'); error.className = 'modal-error'; error.textContent = '当前环境无法解码这个文件。视频建议使用 H.264 MP4 或 WebM；图片建议使用 PNG 或 JPG。';
        media.hidden = true; els.previewStage.appendChild(error);
      });
      els.previewStage.appendChild(media);
      if (tag !== 'img') { var promise = media.play(); if (promise && promise.catch) promise.catch(function () {}); }
    }
    els.previewOverlay.hidden = false; document.body.style.overflow = 'hidden'; els.closePreview.focus();
  }
  function closePreview() {
    if (!els.previewStage) return;
    if (state.focusReturn) state.focusReturn.__pauseUntilMove = true;
    pauseAll(false);
    Array.prototype.forEach.call(els.previewStage.querySelectorAll('video,audio'), function (media) { media.removeAttribute('src'); media.load(); });
    els.previewStage.textContent = ''; els.previewOverlay.hidden = true; document.body.style.overflow = '';
    var trigger = state.focusReturn;
    state.focusReturn = null;
    if (state.modal && trigger && document.body.contains(trigger)) trigger.focus();
    state.modal = false;state.previewItem=null;
  }
  function presetFile(item){return item.projects.filter(function(file){return model.extension(file.name)==='ffx';})[0]||null;}
  function applyPreset(item,button){if(state.applyingPreset){toast('正在应用预设，请稍候。');return;}var file=presetFile(item);if(!file)return;state.applyingPreset=true;button.disabled=true;var label=button.textContent;button.textContent='应用中…';pauseAll(false);
    Promise.resolve().then(function(){return host.applyPreset(file.url(),{calibrateCenters:state.calibrateCenters});}).then(function(result){toast('已将“'+item.name+'”应用到 '+result.count+' 个图层'+(result.points?'，校准 '+result.points+' 个效果中心点':'')+(result.skipped?'；'+result.skipped+' 个表达式控制或不可写的点已跳过':'')+(result.failed?'；'+result.failed+' 个图层失败：'+result.warning:'。可在 AE 中撤销。'),!!result.failed||!!result.skipped);},function(error){toast(error.message||'预设应用失败。',true);}).then(function(){state.applyingPreset=false;button.textContent=label;button.disabled=!host.isCep;if(state.previewItem)els.previewApply.disabled=!host.isCep;});
  }
  function onKeydown(event) {
    if (state.modal) {
      if (event.key === 'Escape') { event.preventDefault(); closePreview(); return; }
      if (event.key === 'Tab') {
        var focusable = Array.prototype.filter.call(els.previewOverlay.querySelectorAll('button,video,audio,[tabindex]'),function(node){return !node.disabled&&!node.hidden&&node.getClientRects().length&&node.getAttribute('tabindex')!=='-1';});
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { event.preventDefault(); els.searchInput.focus(); }
    if (event.key === 'Escape' && state.query) { state.query = ''; els.searchInput.value = ''; renderAssets(); }
  }
  function chooseFolder() {
    if (state.busy) return;
    if (!host.isCep) { els.folderInput.click(); return; }
    setBusy(true);
    host.chooseCepFolder().then(function (library) { setBusy(false); if (library) { addLibrary(library); toast('已导入 ' + library.items.length + ' 个素材。'); } }, function (error) { setBusy(false); toast(error.message || '文件夹读取失败。', true); });
  }
  function setBusy(busy) {
    state.busy = busy;
    Array.prototype.forEach.call(document.querySelectorAll('.add-library'), function (button) { button.disabled = busy; });
    if (busy) toast('正在读取素材文件夹…');
  }
  function toast(message, isError) {
    clearTimeout(state.toastTimer); els.toast.textContent = message; els.toast.className = 'toast' + (isError ? ' error' : ''); els.toast.hidden = false;
    state.toastTimer = setTimeout(function () { els.toast.hidden = true; }, 4200);
  }
  function formatDuration(seconds) { var min = Math.floor(seconds / 60), sec = Math.floor(seconds % 60); return (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec; }
  function formatSize(size) { return size < 1048576 ? (size / 1024).toFixed(0) + ' KB' : (size / 1048576).toFixed(1) + ' MB'; }
}());
