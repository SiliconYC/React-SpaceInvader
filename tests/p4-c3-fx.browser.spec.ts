import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test.use({viewport:{width:1920,height:1080},video:'on'});

test('P4/C3：真实护甲命中→击毁→胜利演出与资源复用',async({page},info)=>{
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:10,type:'guardian'});
    json.waves[0].movement.horizontalSpeed=0;
    json.waves[0].behavior.armorHits=3;
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-fx-armor-events')),
    {timeout:12000}).toBeGreaterThanOrEqual(1);
  await page.screenshot({path:info.outputPath('p4-c3-guardian-armor.png')});
  await expect(stage).toHaveAttribute('data-game-phase','won',{timeout:15000});
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-fx-kind','finish');
  await page.screenshot({path:info.outputPath('p4-c3-victory.png')});
  const firstAllocation=Number(await stage.getAttribute('data-fx-allocated'));
  expect(firstAllocation).toBeLessThanOrEqual(72);
  await page.getByRole('button',{name:'重新开始'}).click();
  await page.getByRole('button',{name:'暂停'}).click();
  await expect(stage).toHaveAttribute('data-fx-active','0');
  expect(Number(await stage.getAttribute('data-fx-reusable'))).toBeGreaterThan(0);
});
test('P4/C3：密集真实战斗 15+ 事件维持上限，暂停／移动端清洁收束',async({page},info)=>{
  test.setTimeout(65000);
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    json.waves[0].attack.shotsPerMinute=360;
    json.waves[0].attack.projectileSpeed=9;
    await route.fulfill({response,json});
  });
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-fx-emitted')),
    {timeout:13000}).toBeGreaterThanOrEqual(15);
  await page.keyboard.up('Space');
  await page.screenshot({path:info.outputPath('p4-c3-dense-desktop.png')});
  const metrics=await stage.evaluate(el=>({
    drawCalls:Number(el.dataset.drawCalls),geometries:Number(el.dataset.gpuGeometries),
    textures:Number(el.dataset.gpuTextures),effects:Number(el.dataset.fxEmitted),
    allocated:Number(el.dataset.fxAllocated),active:Number(el.dataset.fxActive),
    batches:Number(el.dataset.fxBatches),projectilePool:Number(el.dataset.projectilePool),
  }));
  expect(metrics.allocated).toBeLessThanOrEqual(72);
  expect(metrics.active).toBeLessThanOrEqual(72);
  expect(metrics.batches).toBe(8);
  await writeFile(info.outputPath('p4-c3-dense-metrics.json'),JSON.stringify({
    renderer:'real Chromium WebGL; software driver, not hardware phone',metrics,
  },null,2));
  await page.setViewportSize({width:844,height:390});
  await page.screenshot({path:info.outputPath('p4-c3-mobile-landscape.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('p4-c3-mobile-portrait.png')});
  if(await stage.getAttribute('data-game-phase')==='running'){
    await page.getByRole('button',{name:'暂停'}).click();
    await expect(stage).toHaveAttribute('data-fx-active','0');
  }
});
test('P4/C3：减少动态效果仍可以命中、击杀并结算',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:10});
    json.waves[0].movement.horizontalSpeed=0;
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  await page.goto('./');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  const stage=page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-game-phase','won',{timeout:12000});
  await page.keyboard.up('Space');
  expect(Number(await stage.getAttribute('data-fx-allocated'))).toBeLessThanOrEqual(72);
});
