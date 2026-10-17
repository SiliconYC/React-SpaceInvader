import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('P4/B1 可辨识 Raider/Guardian 真三维、常规尺寸与移动端',async({page},info)=>{
  test.setTimeout(110000);
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  const evidence:Record<string,unknown>[]=[];
  const stage=page.getByTestId('battlefield');
  for(const kind of ['raider','guardian'] as const){
    for(const angle of ['front','tilt'] as const){
      await page.setViewportSize({width:1440,height:900});
      await page.goto('./?shipPreview='+kind+(angle==='tilt'?'&shipAngle=tilt':''));
      await expect(stage).toHaveAttribute('data-ship-preview',kind);
      await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
      const stats=await stage.evaluate(el=>({
        draws:Number(el.dataset.drawCalls),assets:Number(el.dataset.gpuAssets),
        geometries:Number(el.dataset.gpuGeometries),textures:Number(el.dataset.gpuTextures),
      }));
      expect(stats.draws).toBeGreaterThan(0);
      evidence.push({kind,angle,...stats});
      await page.screenshot({path:info.outputPath(`p4-b1-${kind}-${angle}.png`),fullPage:true});
    }
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('./');
  await expect(stage).toHaveAttribute('data-enemy-count','24');
  await page.screenshot({path:info.outputPath('p4-b1-scout-player-normal.png'),fullPage:true});
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(stage).toHaveAttribute('data-enemy-kinds','raider');
  await page.screenshot({path:info.outputPath('p4-b1-raider-squad-normal.png'),fullPage:true});
  await page.route('**/levels/crossfire.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    json.waves[0].formation.type='guardian';
    await route.fulfill({response,json});
  });
  await page.getByTestId('level-select').selectOption('first-contact');
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(stage).toHaveAttribute('data-enemy-kinds','guardian');
  await page.screenshot({path:info.outputPath('p4-b1-guardian-squad-normal.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(stage).toHaveAttribute('data-world-width','36');
  await page.screenshot({path:info.outputPath('p4-b1-guardian-portrait.png'),fullPage:true});
  writeFileSync(info.outputPath('p4-b1-metrics.json'),
    JSON.stringify({renderer:'real Chromium WebGL; NOT a physical mobile GPU',evidence},null,2));
  expect(errors).toEqual([]);
});
