(function () {
  'use strict';
  var entries = [
  {
    "name": "小辣椒调色",
    "preview": true
  },
  {
    "name": "红衣服预设",
    "preview": true
  },
  {
    "name": "氛围感2",
    "preview": true
  },
  {
    "name": "氛围感1",
    "preview": true
  },
  {
    "name": "情绪cc",
    "preview": true
  },
  {
    "name": "高清画质0",
    "preview": true
  },
  {
    "name": "(b站)SaRos-cc1",
    "preview": true
  },
  {
    "name": "(b站)SaRos-cc2",
    "preview": true
  },
  {
    "name": "2JenWani CC pack2（cc7）已调整",
    "preview": true
  },
  {
    "name": "AZURE CC",
    "preview": true
  },
  {
    "name": "BERRY CC",
    "preview": true
  },
  {
    "name": "CC 1",
    "preview": true
  },
  {
    "name": "CC 2",
    "preview": true
  },
  {
    "name": "CC 3",
    "preview": true
  },
  {
    "name": "CC 4",
    "preview": true
  },
  {
    "name": "CC 5",
    "preview": true
  },
  {
    "name": "CC 6",
    "preview": true
  },
  {
    "name": "CC Cerulean",
    "preview": true
  },
  {
    "name": "CC Fall Is Here",
    "preview": true
  },
  {
    "name": "CC Polaris",
    "preview": true
  },
  {
    "name": "CC Redwood",
    "preview": true
  },
  {
    "name": "cc4",
    "preview": true
  },
  {
    "name": "CHERRY CC",
    "preview": true
  },
  {
    "name": "Cold cc",
    "preview": true
  },
  {
    "name": "Coloring1",
    "preview": true
  },
  {
    "name": "Coloring2",
    "preview": true
  },
  {
    "name": "Coloring3",
    "preview": true
  },
  {
    "name": "Coloring4",
    "preview": true
  },
  {
    "name": "Dark CC",
    "preview": true
  },
  {
    "name": "DAWN CC",
    "preview": true
  },
  {
    "name": "iary basic bokeh",
    "preview": true
  },
  {
    "name": "iary basic cc",
    "preview": true
  },
  {
    "name": "joe dark cc ( @JOESERVER IN TG )",
    "preview": true
  },
  {
    "name": "looks调色一",
    "preview": false
  },
  {
    "name": "looks调色三",
    "preview": false
  },
  {
    "name": "looks调色二（偏朦胧）",
    "preview": false
  },
  {
    "name": "Quality cc",
    "preview": true
  },
  {
    "name": "REMASTERED ICE CC",
    "preview": false
  },
  {
    "name": "Sai color correction pls give credit 94e",
    "preview": true
  },
  {
    "name": "SPRING CC",
    "preview": true
  },
  {
    "name": "SUNSET CC",
    "preview": true
  },
  {
    "name": "Vibe cc",
    "preview": true
  },
  {
    "name": "xiaolajiao最终版",
    "preview": true
  }
];
  var records = [];
  entries.forEach(function (entry) {
    (entry.preview ? ['ffx', 'png'] : ['ffx']).forEach(function (extension) {
      var filename = entry.name + '.' + extension;
      records.push({name: filename, relativePath: filename, size: 0, modified: 0,
        url: function () {return 'assets/color2-presets/' + encodeURIComponent(filename);}});
    });
  });
  window.YueHaiColor2Presets = {id: 'yuehai-color2-presets', name: '调色2', imageOnly: true,
    description: '39 张实际调色图片 / 43 个预设 · 使用预览图.jpg · 双击查看完整图片',
    failures: {
  "looks调色一": "需要更高版本的 After Effects，当前 AE 2023 无法完整应用此预设。",
  "looks调色三": "需要更高版本的 After Effects，当前 AE 2023 无法完整应用此预设。",
  "looks调色二（偏朦胧）": "需要更高版本的 After Effects，当前 AE 2023 无法完整应用此预设。",
  "REMASTERED ICE CC": "需要更高版本的 After Effects，当前 AE 2023 无法完整应用此预设。"
},
    notes: {'iary basic bokeh': '预览已适配中文版 AE 的 Gamma 属性引用；原始预设保留。', 'BERRY CC': '此预设叠加 4 层 Looks，当前照片呈现强烈高光效果。'},
    records: records, release: function () {}};
}());
