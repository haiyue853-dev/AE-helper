(function () {
  'use strict';
  var names = ['LILI转场1', 'LILI转场2', 'LILI转场3', 'LILI转场4', 'LILI转场5', 'LILIend'];
  var records = [];
  names.forEach(function (name) {
    ['ffx', 'mp4', 'png'].forEach(function (extension) {
      var filename = name + '.' + extension;
      records.push({ name: filename, relativePath: filename, size: 0, modified: 0,
        url: function () { return 'assets/lili-presets/' + encodeURIComponent(filename); } });
    });
  });
  window.YueHaiLiliPresets = { id: 'yuehai-lili-presets', name: 'LILI转场', portrait: true,
    description: '6 个实际预设 · 竖屏原图比例 · 完整转场循环',
    records: records, release: function () {} };
}());
