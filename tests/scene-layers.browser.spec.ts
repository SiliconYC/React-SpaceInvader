import {test,expect} from '@playwright/test';
test('P3/A2: 分层稳定，不渲染工程背板；触边射击与横竖屏回归',async({page},info)=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage).toHaveAttribute('data-scene-layers','starfield,celestial,environment,combat,foreground');
  // #36 originally verified an empty foreground; #45 now supplies four strictly gated meshes.
  await expect(stage).toHaveAttribute('data-foreground-count','4');
  await expect.poll(async()=>Number(await stage.getAttribute('data-foreground-visible'))).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('p3-layer-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(2200);
  await page.keyboard.up('ArrowRight');
  expect(Number(await stage.getAttribute('data-player-x'))).toBeGreaterThan(31);
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-bullet-count'))).toBeGreaterThan(0);
  await page.keyboard.up('Space');
  await page.screenshot({path:info.outputPath('p3-edge-combat.png'),fullPage:true});
  await page.setViewportSize({width:430,height:820});
  await expect(stage).toHaveAttribute('data-foreground-visible','0');
  await expect(stage).toHaveAttribute('data-world-width','36');
  await page.screenshot({path:info.outputPath('p3-layer-portrait.png'),fullPage:true});
  expect(errors).toEqual([]);
});
