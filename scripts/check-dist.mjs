import { readFile, readdir, stat } from 'node:fs/promises';

const index = await readFile('dist/index.html', 'utf8');
const assets = await readdir('dist/assets');
const js = assets.filter(file => file.endsWith('.js'));
const css = assets.filter(file => file.endsWith('.css'));

if (!index.includes('/React-SpaceInvader/assets/')) {
  throw new Error('GitHub Pages 项目子路径错误');
}
if (!js.length || !css.length) {
  throw new Error('缺少编译后的 JS 或 CSS');
}
if (/(?:src|href)=["']https?:\/\//.test(index)) {
  throw new Error('入口意外依赖第三方 CDN');
}
if ((await stat('dist/index.html')).size < 200) {
  throw new Error('HTML 产物不完整');
}
console.log('通过：Pages 子路径、JS/CSS 产物、同源入口检查');
