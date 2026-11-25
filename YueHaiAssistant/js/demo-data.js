(function () {
  'use strict';
  var entries = [
    { name: '月海流光', label: 'LIGHT · 光影', description: '柔和光线，缓缓流动', number: '01', color: '#7baff0' },
    { name: '柔光渐变', label: 'COLOR · 色彩', description: '让色彩在呼吸之间交融', number: '02', color: '#d4a0dc' },
    { name: '粒子轨道', label: 'PARTICLES · 粒子', description: '捕捉微小而有序的引力', number: '03', color: '#8fc6bd' },
    { name: '文字跃动', label: 'TYPE · 文字', description: '给每一个字，一点生命力', number: '04', color: '#d4cfac' },
    { name: '胶片时刻', label: 'TEXTURE · 质感', description: '在光与颗粒中，留住瞬间', number: '05', color: '#d8ab7e' },
    { name: '空间折叠', label: 'SPACE · 空间', description: '越过平面，探索新的维度', number: '06', color: '#abaae2' },
    { name: '静谧海岸', label: 'STILL · 静帧', description: '给画面留一些呼吸的空间', number: '07', color: '#94bbcd', imageOnly: true },
    { name: '蓝调时分', label: 'STILL · 静帧', description: '来自夜色的一张色彩便笺', number: '08', color: '#91a8df', imageOnly: true }
  ];
  var records = [];
  entries.forEach(function (entry) {
    ['png'].concat(entry.imageOnly ? [] : ['webm']).forEach(function (ext) {
      var src = 'assets/demo/' + entry.number + '.' + ext;
      records.push({ name: entry.name + '.' + ext, relativePath: entry.name + '.' + ext, size: 0, modified: 0, url: function () { return src; } });
    });
  });
  window.YueHaiDemo = { id: 'yuehai-demo', name: '灵感示例', demo: true, records: records, entries: entries, release: function () {} };
}());
