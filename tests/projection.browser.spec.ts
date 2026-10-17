import { test, expect } from '@playwright/test';

async function assertProjection(page: import('@playwright/test').Page) {
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  // Read all viewport and camera metrics atomically: ResizeObserver may run between awaits.
  await expect.poll(async()=>{
    return stage.evaluate(e=>{
      const d=(key:string)=>Number(e.getAttribute('data-'+key));
      const width=e.clientWidth,height=e.clientHeight;
      const pixels=height/d('camera-span-y');
      const expectedX=width/2+(d('player-x')-d('world-width')/2)*pixels;
      const expectedY=height/2-(d('player-y')-d('world-height')/2-d('camera-center-y'))*pixels;
      return Math.max(Math.abs(expectedX-d('player-screen-x')),
        Math.abs(expectedY-d('player-screen-y')));
    });
  },{timeout:5000}).toBeLessThan(.06);
  const spanX=Number(await stage.getAttribute('data-camera-span-x'));
  expect(spanX).toBeGreaterThan(36);

}
test('P3/A1: 正交基线与弱透视 XY 投影一致，桌面与窄屏均保留原有操作',async({page},info)=>{
  for(const mode of ['ortho','perspective'] as const){
    await page.goto(mode==='ortho'?'./':'./?projection=perspective');
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
    await page.goto('./?projection=perspective');
    await expect(page.getByTestId('battlefield')).toHaveAttribute('data-camera-projection','perspective');
    await assertProjection(page);
    await page.screenshot({path:info.outputPath('p3-touch-portrait.png'),fullPage:true});
  }finally{await context.close();}
});
