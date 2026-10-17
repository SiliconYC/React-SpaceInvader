import {test,expect} from '@playwright/test';
test('P3/D1：桌面、窄屏三维材质与柔光保持可辨且 DrawCall 有界',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage).toHaveAttribute('data-p3-light-rig','4');
  await expect(stage).toHaveAttribute('data-p3-tone-exposure','1.07');
  expect(Number(await stage.getAttribute('data-draw-calls'))).toBeLessThan(72);
  await page.screenshot({path:info.outputPath('p3-d1-lighting-desktop.png'),fullPage:true});
  await page.goto('./?shipPreview=guardian');
  await expect(stage).toHaveAttribute('data-ship-preview','guardian');
  await page.screenshot({path:info.outputPath('p3-d1-guardian-material.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await expect(stage).toHaveAttribute('data-foreground-visible','0');
  await page.screenshot({path:info.outputPath('p3-d1-lighting-portrait.png'),fullPage:true});
  expect(errors).toEqual([]);
});
