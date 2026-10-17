import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('P4/B3 安全岩石的真实屏幕体量/前景裁剪/低速三轴运动',async({page},info)=>{
  test.setTimeout(95000);
  const stage=page.getByTestId('battlefield');
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  const views:Record<string,unknown>[]=[];
  for(const size of [{width:1920,height:1080},{width:1280,height:720},
    {width:844,height:390},{width:390,height:844}]){
    await page.setViewportSize(size);
    await page.goto('./');
    await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
    await expect(stage).toHaveAttribute('data-asteroid-batches','5');
    await expect(stage).toHaveAttribute('data-foreground-rocks','2');
    const data=await stage.evaluate(el=>({
      foreground:+(el.dataset.foregroundVisible??0),
      asteroids:+(el.dataset.asteroidVisible??0),
      draws:+(el.dataset.drawCalls??0),
      assets:+(el.dataset.gpuAssets??0),
      textures:+(el.dataset.gpuTextures??0),
    }));
    if(size.width<900)expect(data.foreground).toBe(0);
    if(size.width===390)expect(data.asteroids).toBe(0);
    expect(data.draws).toBeLessThan(72);
    views.push({...size,...data});
    await page.screenshot({path:info.outputPath(`p4-b3-rocks-${size.width}x${size.height}.png`),fullPage:true});
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('./');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('Space');
  for(let frame=0;frame<3;frame++){
    await page.waitForTimeout(130);
    await page.screenshot({path:info.outputPath('p4-b3-motion-'+frame+'.png'),fullPage:true});
  }
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('Space');
  const x=Number(await stage.getAttribute('data-player-x'));
  expect(x).toBeLessThan(18);
  writeFileSync(info.outputPath('p4-b3-metrics.json'),JSON.stringify({
    renderer:'Real Chromium WebGL; no physical phone-GPU measurements',views},null,2));
  expect(errors).toEqual([]);
});
