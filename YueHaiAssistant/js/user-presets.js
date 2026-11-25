(function () {
  'use strict';
  var names = ['shake 1', 'y后', 'bheibai', 'adibaohe'];
  var records = [];
  names.forEach(function (name) {
    ['ffx', 'mp4', 'png'].forEach(function (extension) {
      var fileName = name + '.' + extension;
      records.push({ name: fileName, relativePath: fileName, size: 0, modified: 0,
        url: function () { return 'assets/user-presets/' + encodeURIComponent(fileName); } });
    });
  });
  window.YueHaiPresetSamples = { id: 'yuehai-preset-samples', name: '我的预设试看片',
    description: '使用预览图.jpg · 左侧原图，右侧预设效果 · 每段 4 秒',
    records: records, release: function () {} };
}());
