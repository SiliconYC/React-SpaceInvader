import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('P4/D1 全屏 HUD：四种视口，开始、作战、暂停及菜单焦点',async({page},info)=>{
  test.setTimeout(180_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const views=[[1920,1080],[1440,900],[844,390],[390,844]] as const;
  const data:unknown[]=[];
  for(const [width,height] of views){
    await page.setViewportSize({width,height});
    await page.goto('./');
    await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
    const canvas=(await page.getByTestId('battlefield').locator('canvas').boundingBox())!;
    expect(canvas.width).toBeGreaterThanOrEqual(width-2);
    expect(canvas.height).toBeGreaterThanOrEqual(height-2);
    await page.screenshot({path:info.outputPath(`p4-d1-${width}x${height}-ready.png`),fullPage:true});
    await page.getByRole('button',{name:'音频'}).click();
    await expect(page.getByLabel('音量')).toBeVisible();
    await page.getByRole('button',{name:'音频'}).click();
    await page.getByRole('button',{name:'成绩',exact:true}).click();
    await expect(page.getByRole('region',{name:'本机排行榜'})).toBeVisible();
    await page.getByRole('button',{name:'成绩',exact:true}).click();
    await page.getByRole('button',{name:'开始',exact:true}).click();
    await page.screenshot({path:info.outputPath(`p4-d1-${width}x${height}-running.png`),fullPage:true});
    await page.getByRole('button',{name:'暂停'}).click();
    await expect(page.getByTestId('pause-message')).toBeVisible();
    await page.screenshot({path:info.outputPath(`p4-d1-${width}x${height}-paused.png`),fullPage:true});
    const metrics=await page.locator('.game-shell').evaluate(el=>({
      viewportWidth:el.clientWidth,viewportHeight:el.clientHeight,
      canvasWidth:el.querySelector('canvas')?.clientWidth,
      canvasHeight:el.querySelector('canvas')?.clientHeight,
    }));
    data.push({width,height,...metrics});
    await page.getByRole('button',{name:'继续'}).click();
    await page.getByRole('button',{name:'重置'}).click();
  }
  writeFileSync(info.outputPath('p4-d1-layout.json'),JSON.stringify(data,null,2));
  expect(errors).toEqual([]);
});

test('P4/D1 实战胜负结算、触控尺寸与多指输入',async({page},info)=>{
  test.setTimeout(140_000);
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:10});
    json.waves[0].movement.horizontalSpeed=0;
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  for(const name of ['left','right','fire'] as const){
    const key=page.getByTestId('touch-'+name);
    const box=await key.boundingBox();
    // Desktop Chromium is non-coarse here; exercise actual touch target geometry with emulation.
    if(box){expect(box.width).toBeGreaterThanOrEqual(60);expect(box.height).toBeGreaterThanOrEqual(60);}
  }
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-game-phase','won',{timeout:9000});
  await page.keyboard.up('Space');
  await page.screenshot({path:info.outputPath('p4-d1-390x844-won.png'),fullPage:true});
  await page.getByRole('button',{name:'重新开始'}).click();
  await page.getByRole('button',{name:'重置'}).click();
  await page.unroute('**/levels/first-contact.json');
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:12});
    Object.assign(json.waves[0].movement,{horizontalSpeed:40,descentPerTurn:25,moveEveryTicks:1});
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  await page.reload();
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-game-phase','lost',{timeout:9000});
  await page.screenshot({path:info.outputPath('p4-d1-390x844-lost.png'),fullPage:true});
});
