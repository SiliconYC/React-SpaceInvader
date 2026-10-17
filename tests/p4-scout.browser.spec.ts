import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('P4/A3 Scout: 真 3D 单体三分之四近景及 24/40 实例编队',async({page},info)=>{
  test.setTimeout(85000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('./?shipPreview=scout');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage).toHaveAttribute('data-ship-preview','scout');
  await page.screenshot({path:info.outputPath('p4-a3-scout-close-front.png'),fullPage:true});
  await page.goto('./?shipPreview=scout&shipAngle=tilt');
  await expect(stage).toHaveAttribute('data-ship-preview','scout');
  await page.screenshot({path:info.outputPath('p4-a3-scout-close-quarter.png'),fullPage:true});
  await page.goto('./');
  await expect(stage).toHaveAttribute('data-enemy-count','24');
  const normal=await stage.evaluate(el=>({
    draws:+(el.dataset.drawCalls??'0'),assets:+(el.dataset.gpuAssets??'0'),
  }));
  await page.screenshot({path:info.outputPath('p4-a3-scout-squad-24.png'),fullPage:true});
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    json.waves[0].formation.rows=5;
    json.waves[0].formation.startY=21;
    json.waves[0].formation.spacingY=2.2;
    await route.fulfill({response,json});
  });
  await page.reload();
  await expect(stage).toHaveAttribute('data-enemy-count','40');
  const dense=await stage.evaluate(el=>({
    draws:+(el.dataset.drawCalls??'0'),assets:+(el.dataset.gpuAssets??'0'),
  }));
  expect(dense.assets).toBe(normal.assets);
  expect(dense.draws).toBeLessThanOrEqual(normal.draws+2);
  await page.screenshot({path:info.outputPath('p4-a3-scout-squad-40.png'),fullPage:true});
  writeFileSync(info.outputPath('p4-a3-scout-calls.json'),JSON.stringify({normal,dense},null,2));
  expect(errors).toEqual([]);
});
