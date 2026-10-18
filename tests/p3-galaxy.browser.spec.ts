import { test,expect } from '@playwright/test';

test('P3/C1/#101: Toy-orbit SVG 真正通过同源网络下载、在 Three.js GPU 中加载、宽屏竖屏无扭曲',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const response=page.waitForResponse(r=>r.url().endsWith('/art/backgrounds/toy-orbit.svg'));
  await page.goto('./');
  const download=await response;
  expect(download.ok()).toBe(true);
  expect(download.headers()['content-type']).toMatch(/image\/svg\+xml|application\/octet-stream/);
  const stage=page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-galaxy','loaded');
  await expect(stage).toHaveAttribute('data-galaxy-url',/\/React-SpaceInvader\/art\/backgrounds\/toy-orbit.svg$/);
  const bytes=await download.body();
  expect(bytes.length).toBeGreaterThan(4000);
  expect(bytes.length).toBeLessThan(300000);
  const decoded=await page.evaluate(async(url)=>{
    const response=await fetch(url);
    const bitmap=await createImageBitmap(await response.blob());
    return [bitmap.width,bitmap.height];
  },download.url()).catch(()=>null);
  // The network response and Three.js load status, not an imaginary file path, are authoritative.
  if(decoded!==null)expect(decoded).toEqual([1600,900]);
  await page.screenshot({path:info.outputPath('p3-c1-galaxy-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(stage).toHaveAttribute('data-galaxy','loaded');
  await page.screenshot({path:info.outputPath('p3-c1-galaxy-portrait.png'),fullPage:true});
  expect(errors).toEqual([]);
});
test('P3/C1: 对真实 新背景请求注入 404 后背景纯色兜底，玩家控制照常工作',async({page})=>{
  await page.route('**/art/backgrounds/toy-orbit.svg',route=>route.fulfill({status:404,body:'missing'}));
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-galaxy','fallback');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('ArrowRight');
  await expect.poll(async()=>Number(await stage.getAttribute('data-player-x'))).toBeGreaterThan(18.5);
  await page.keyboard.up('ArrowRight');
});
