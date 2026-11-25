(function (root, factory) {
  if (typeof window !== 'undefined') root.YueHaiModel = factory();
  else if (typeof module === 'object' && module.exports) module.exports = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var video = ['mp4', 'webm', 'm4v', 'mov', 'ogv', 'mkv', 'avi', 'wmv'];
  var audio = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aif', 'aiff'];
  var image = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'];
  var project = ['ffx', 'aep', 'aepx'];

  function normalize(path) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''); }
  function extension(name) { return name.indexOf('.') < 0 ? '' : name.split('.').pop().toLowerCase(); }
  function pick(files, priorities) {
    var candidates = files.filter(function (file) { return priorities.indexOf(extension(file.name)) !== -1; });
    candidates.sort(function (a, b) { return priorities.indexOf(extension(a.name)) - priorities.indexOf(extension(b.name)); });
    return candidates[0] || null;
  }
  function groupFiles(records) {
    var groups = Object.create(null);
    records.forEach(function (record) {
      var path = normalize(record.relativePath || record.name);
      var segments = path.split('/');
      if (segments.some(function (part) { return part.charAt(0) === '.'; })) return;
      var name = segments.pop();
      var ext = extension(name);
      if (name.toLowerCase() === 'cover.png' || video.concat(audio, image, project).indexOf(ext) === -1) return;
      var base = name.slice(0, -(ext.length + 1));
      var folder = segments.join('/');
      var id = folder + '/' + base.toLowerCase();
      if (!groups[id]) groups[id] = { id: id, name: base, folder: folder, files: [], size: 0, modified: 0 };
      groups[id].files.push(record);
      groups[id].size += Number(record.size) || 0;
      groups[id].modified = Math.max(groups[id].modified, Number(record.modified) || 0);
    });
    return Object.keys(groups).map(function (key) {
      var item = groups[key];
      item.projects = item.files.filter(function (file) { return project.indexOf(extension(file.name)) !== -1; });
      item.video = pick(item.files, video);
      item.audio = pick(item.files, audio);
      item.image = pick(item.files, image);
      item.kind = item.projects.some(function (file) { return extension(file.name) === 'ffx'; }) ? 'preset'
        : item.projects.length ? 'project' : item.video ? 'video' : item.audio ? 'audio' : 'image';
      return item;
    });
  }
  function selectItems(items, options) {
    options = options || {};
    var query = String(options.query || '').trim().toLowerCase();
    var result = items.filter(function (item) {
      if ((!query || options.recursive) && typeof options.folder === 'string') {
        if (options.recursive) {
          if (options.folder && item.folder !== options.folder && item.folder.indexOf(options.folder + '/') !== 0) return false;
        } else if (item.folder !== options.folder) return false;
      }
      if (query && (item.name + ' ' + item.folder + ' ' + item.files.map(function (file) { return file.name; }).join(' ')).toLowerCase().indexOf(query) === -1) return false;
      if (options.type && options.type !== 'all' && item.kind !== options.type) return false;
      if (options.favoritesOnly && !(options.favorites || {})[item.id]) return false;
      if (options.previewStatus && options.previewStatus !== 'all' && previewStatus(item, options.library) !== options.previewStatus) return false;
      return true;
    });
    if (options.sort === 'default') return result;
    return result.sort(function (a, b) {
      if (options.sort === 'recent') return b.modified - a.modified || a.name.localeCompare(b.name);
      var compared = a.name.localeCompare(b.name, 'zh-CN', { numeric: true, sensitivity: 'base' });
      return options.sort === 'desc' ? -compared : compared;
    });
  }
  function getFolders(items, folder) {
    var prefix = folder ? folder + '/' : '';
    var folders = Object.create(null);
    items.forEach(function (item) {
      if (item.folder.indexOf(prefix) !== 0 || item.folder === folder) return;
      var name = item.folder.slice(prefix.length).split('/')[0];
      if (!name) return;
      if (!folders[name]) folders[name] = { name: name, path: prefix + name, count: 0 };
      folders[name].count++;
    });
    return Object.keys(folders).sort().map(function (name) { return folders[name]; });
  }
  function previewStatus(item, library) {
    library=library||{};
    if(library.failures&&(library.failures[item.id]||library.failures[item.name]))return 'failed';
    if(library.pending&&(library.pending[item.id]||library.pending[item.name]))return 'pending';
    return library.previewStates&&library.previewStates[item.id]||(item.video||item.image?'ready':'missing');
  }
  function getAllFolders(items, declared) {
    var folders = Object.create(null);
    items.forEach(function (item) {
      var parts = item.folder ? item.folder.split('/') : [], path = '';
      parts.forEach(function (name) {
        path += (path ? '/' : '') + name;
        if (!folders[path]) folders[path] = {name: name, path: path, count: 0};
        folders[path].count++;
      });
    });
    (declared||[]).forEach(function(path){if(!folders[path])folders[path]={name:path.split('/').pop(),path:path,count:0};});
    return Object.keys(folders).sort(function (a, b) { return a.localeCompare(b, 'zh-CN', {numeric: true}); }).map(function (path) { return folders[path]; });
  }
  function combinePresetLibraries(sources) {
    var result = {id: 'yuehai-my-presets', name: '我的预设', builtin: true, records: [], failures: {}, pending: {}, notes: {}, layouts: {}, release: function () {}};
    sources.forEach(function (source) {
      var library = source.library;
      if (!library) return;
      var prefix = source.prefix ? source.prefix + '/' : '';
      library.records.forEach(function (record) {
        var copy = {};
        Object.keys(record).forEach(function (key) { copy[key] = record[key]; });
        copy.relativePath = prefix + normalize(record.relativePath || record.name);
        result.records.push(copy);
      });
      groupFiles(library.records).forEach(function (item) {
        var id = prefix ? prefix + item.id.replace(/^\//, '') : item.id;
        ['failures', 'pending', 'notes'].forEach(function (field) {
          var messages = library[field], message = messages && (messages[item.id] || messages[item.name]);
          if (message) result[field][id] = message;
        });
        result.layouts[id] = {imageOnly: !!library.imageOnly, portrait: !!library.portrait};
      });
    });
    result.description = groupFiles(result.records).length + ' 个本地预设 · 选择文件夹查看 · 悬停播放，双击放大';
    return result;
  }
  function mergeGeneratedLibrary(base, generated) {
    var incoming = combinePresetLibraries([{library: generated, prefix: generated.prefix || ''}]);
    var replacements = Object.create(null);
    groupFiles(incoming.records).forEach(function (item) { replacements[item.id] = true; });
    var records = [];
    groupFiles(base.records).forEach(function (item) { if (!replacements[item.id]) records = records.concat(item.files); });
    base.records = records.concat(incoming.records);
    ['failures', 'pending', 'notes', 'layouts'].forEach(function (field) {
      if (!base[field]) base[field] = {};
      Object.keys(replacements).forEach(function (id) { delete base[field][id]; });
      Object.keys(incoming[field]).forEach(function (id) { base[field][id] = incoming[field][id]; });
    });
    base.description = groupFiles(base.records).length + ' 个本地预设 · 选择文件夹查看 · 悬停播放，双击放大';
    return base;
  }
  return { groupFiles: groupFiles, selectItems: selectItems, getFolders: getFolders, getAllFolders: getAllFolders,
    previewStatus:previewStatus,
    combinePresetLibraries: combinePresetLibraries, mergeGeneratedLibrary: mergeGeneratedLibrary, extension: extension, normalize: normalize };
}));
