import {test,expect} from '@playwright/test';

test('P3/B2: 三类敌机真 Three.js 近景与正常密集实例阵列，GPU 资源恒定',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const assets=Number(await stage.getAttribute('data-gpu-assets'));
  const drawCalls=Number(await stage.getAttribute('data-draw-calls'));
  expect(drawCalls).toBeLessThan(65);
  expect(assets).toBeGreaterThan(20);
  await page.screenshot({path:info.outputPath('p3-b2-scout-squad.png'),fullPage:true});
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(stage).toHaveAttribute('data-enemy-kinds','raider');
  await expect(stage).toHaveAttribute('data-gpu-assets',String(assets));
  await page.screenshot({path:info.outputPath('p3-b2-raider-squad.png'),fullPage:true});
  for(const kind of ['scout','raider','guardian'] as const) {
    await page.goto('./?shipPreview='+kind);
    await expect(stage).toHaveAttribute('data-ship-preview',kind);
    await expect(stage).toHaveAttribute('data-gpu-assets',String(assets));
    await page.screenshot({path:info.outputPath('p3-b2-'+kind+'-close.png'),fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await expect(stage).toHaveAttribute('data-enemy-count','24');
  await expect(stage).toHaveAttribute('data-world-width','36');
  await page.screenshot({path:info.outputPath('p3-b2-scout-portrait.png'),fullPage:true});
  expect(errors).toEqual([]);
});
