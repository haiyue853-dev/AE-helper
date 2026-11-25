const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../YueHaiAssistant/js/asset-model.js');

test('CEP 混合上下文同时存在 window 与 module 时，仍向界面暴露素材模型', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../YueHaiAssistant/js/asset-model.js'), 'utf8');
  const context = { window: {}, module: { exports: {} } };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.window.YueHaiModel, 'object');
  assert.equal(typeof context.window.YueHaiModel.groupFiles, 'function');
});

function file(path) { return { name: path.split('/').pop(), relativePath: path, size: 50 }; }

test('同目录同名工程、预设、视频与图片合并，格式匹配不区分大小写', () => {
  const items = model.groupFiles(['光效.AEP', '光效.FFX', '光效.mp4', '光效.png'].map(file));
  assert.equal(items.length, 1);
  assert.equal(items[0].name, '光效');
  assert.equal(items[0].projects.length, 2);
  assert.equal(items[0].video.name, '光效.mp4');
  assert.equal(items[0].image.name, '光效.png');
  assert.equal(items[0].kind, 'preset');
});

test('不同子目录中的同名素材不合并', () => {
  const items = model.groupFiles(['甲/光效.ffx', '乙/光效.mp4'].map(file));
  assert.equal(items.length, 2);
  assert.notEqual(items[0].id, items[1].id);
});

test('独立视频和音频保留，忽略封面、隐藏文件及未知格式', () => {
  const items = model.groupFiles(['cover.png', '.cache/a.mp4', 'clip.webm', '声音.wav', '说明.txt'].map(file));
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(item => item.kind).sort(), ['audio', 'video']);
});

test('多种预览视频优先选择 mp4，其他文件保留在关联列表', () => {
  const items = model.groupFiles(['clip.mov', 'clip.webm', 'clip.mp4'].map(file));
  assert.equal(items.length, 1);
  assert.equal(items[0].video.name, 'clip.mp4');
  assert.equal(items[0].files.length, 3);
});

test('搜索包含子目录且忽略大小写，类型与收藏过滤可组合', () => {
  const items = model.groupFiles(['转场/Glow.ffx', '转场/Glow.mp4', '声音.wav'].map(file));
  const favorites = { [items.find(item => item.name === 'Glow').id]: true };
  const selected = model.selectItems(items, { query: 'glow', type: 'preset', favoritesOnly: true, favorites });
  assert.equal(selected.length, 1);
  assert.equal(model.selectItems(items, { query: '转场' }).length, 1);
  assert.equal(model.selectItems(items, { query: '不存在' }).length, 0);
});

test('目录视图只列当前层级素材，并给出直接子目录', () => {
  const items = model.groupFiles(['根.mp4', '转场/a.ffx', '转场/柔和/b.mp4'].map(file));
  assert.equal(model.selectItems(items, { folder: '' }).length, 1);
  assert.deepEqual(model.getFolders(items, ''), [{ name: '转场', path: '转场', count: 2 }]);
  assert.deepEqual(model.getFolders(items, '转场'), [{ name: '柔和', path: '转场/柔和', count: 1 }]);
  assert.equal(model.selectItems(items, { folder: '', query: 'b' }).length, 1);
});

test('文件夹菜单一次列出所有层级，选择父文件夹直接显示下级预设并限定搜索范围', () => {
  const items = model.groupFiles(['根.ffx', '工具箱/文字/入场/a.ffx', '工具箱/文字/b.ffx', '工具箱2/a.ffx'].map(file));
  assert.deepEqual(model.getAllFolders(items).map(f => [f.path, f.count]), [
    ['工具箱', 2], ['工具箱/文字', 2], ['工具箱/文字/入场', 1], ['工具箱2', 1]
  ]);
  assert.equal(model.selectItems(items, {folder: '', recursive: true}).length, 4);
  assert.equal(model.selectItems(items, {folder: '工具箱', recursive: true}).length, 2);
  assert.equal(model.selectItems(items, {folder: '工具箱/文字/入场', recursive: true})[0].name, 'a');
  assert.equal(model.selectItems(items, {folder: '工具箱', recursive: true, query: 'a'}).length, 1);
});

test('真实预设合并到同一目录，保留同名预设各自的预览、失败原因和显示比例', () => {
  const main = {records: [file('文字/同名.ffx')], portrait: true, failures: {'文字/同名': '主目录原因'}};
  const color = {records: [file('同名.ffx'), {...file('同名.png'), url: () => 'actual.png'}], imageOnly: true, notes: {'同名': '调色备注'}};
  const merged = model.combinePresetLibraries([{library: main, prefix: ''}, {library: color, prefix: '调色2'}]);
  const items = model.groupFiles(merged.records);
  assert.equal(items.length, 2);
  assert.equal(items.find(i => i.folder === '调色2').image.url(), 'actual.png');
  assert.equal(merged.failures['文字/同名'], '主目录原因');
  assert.equal(merged.notes['调色2/同名'], '调色备注');
  assert.deepEqual(merged.layouts['调色2/同名'], {imageOnly: true, portrait: false});
  assert.equal(merged.layouts['文字/同名'].portrait, true);
});

test('自动生成结果更新原来的文件夹，替换旧媒体并保留其他预设和收藏使用的标识', () => {
  const base=model.combinePresetLibraries([{library:{records:[file('转场/a.ffx'),file('转场/a.mp4'),file('字体/b.ffx')],failures:{'转场/a':'旧失败'}},prefix:''}]);
  const generated={prefix:'转场',records:[file('a.ffx'),{...file('a.mp4'),url:()=> 'new.mp4'},file('c.ffx')],portrait:true,failures:{'/c':'插件不可用'}};
  model.mergeGeneratedLibrary(base,generated);
  const items=model.groupFiles(base.records);
  assert.equal(items.length,3);assert.equal(items.find(i=>i.id==='转场/a').video.url(),'new.mp4');
  assert.ok(items.find(i=>i.id==='字体/b'));assert.equal(base.failures['转场/a'],undefined);assert.equal(base.failures['转场/c'],'插件不可用');
  assert.equal(base.layouts['转场/a'].portrait,true);
});
