import { test, expect } from '@playwright/test';

async function assertProjection(page: import('@playwright/test').Page) {
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const width=await stage.evaluate(e=>e.clientWidth);
  const height=await stage.evaluate(e=>e.clientHeight);
  const worldW=Number(await stage.getAttribute('data-world-width'));
  const worldH=Number(await stage.getAttribute('data-world-height'));
  const spanY=Number(await stage.getAttribute('data-camera-span-y'));
  const centerY=Number(await stage.getAttribute('data-camera-center-y'));
  const x=Number(await stage.getAttribute('data-player-x'));
  const y=Number(await stage.getAttribute('data-player-y'));
  const sx=Number(await stage.getAttribute('data-player-screen-x'));
  const sy=Number(await stage.getAttribute('data-player-screen-y'));
  expect(Math.abs(sx-(width/2+(x-worldW/2)*height/spanY))).toBeLessThan(.05);
  expect(Math.abs(sy-(height/2-(y-worldH/2-centerY)*height/spanY))).toBeLessThan(.05);
  expect(Number(await stage.getAttribute('data-camera-span-x'))).toBeGreaterThan(worldW);
}
test('P3/A1: 正交基线与弱透视 XY 投影一致，桌面与窄屏均保留原有操作',async({page},info)=>{
  for(const mode of ['ortho','perspective'] as const){
    await page.goto(mode==='ortho'?'./?projection=ortho':'./');
    const stage=page.getByTestId('battlefield');
    await expect(stage).toHaveAttribute('data-camera-projection',mode==='ortho'?'orthographic':'perspective');
    await assertProjection(page);
    await page.screenshot({path:info.outputPath('p3-'+mode+'-desktop.png'),fullPage:true});
    await page.setViewportSize({width:430,height:780});
    await assertProjection(page);
    await page.screenshot({path:info.outputPath('p3-'+mode+'-portrait.png'),fullPage:true});
    await page.getByRole('button',{name:'开始',exact:true}).click();
    await page.keyboard.down('ArrowRight');
    const initial=Number(await stage.getAttribute('data-player-x'));
    await expect.poll(async()=>Number(await stage.getAttribute('data-player-x'))).toBeGreaterThan(initial+.25);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('Space');
    await expect.poll(async()=>Number(await stage.getAttribute('data-bullet-count'))).toBeGreaterThan(0);
    await page.keyboard.up('Space');
    await page.setViewportSize({width:1280,height:720});
  }
});
test('P3/A1: 触控竖屏透视不改变 XY 瞄准中心',async({browser},info)=>{
  const context=await browser.newContext({baseURL:info.project.use.baseURL as string,viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  try{
    const page=await context.newPage();
    await page.goto('./');
    await expect(page.getByTestId('battlefield')).toHaveAttribute('data-camera-projection','perspective');
    await assertProjection(page);
    await page.screenshot({path:info.outputPath('p3-touch-portrait.png'),fullPage:true});
  }finally{await context.close();}
});
