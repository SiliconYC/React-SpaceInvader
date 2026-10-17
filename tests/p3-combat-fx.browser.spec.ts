import {test,expect} from '@playwright/test';

test('P3/D2：真实射击、低模击毁碎片与复用对象池（桌面/手机）',async({page},info)=>{
  await page.route('**/levels/first-contact.json',async route=>{
    const res=await route.fetch(),json=await res.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:10});
    json.waves[0].movement.horizontalSpeed=0;
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response:res,json});
  });
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-score')),{timeout:15000}).toBe(10);
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-game-phase','won');
  await expect(stage).toHaveAttribute('data-fx-kind','finish');
  const allocated=Number(await stage.getAttribute('data-fx-allocated'));
  expect(allocated).toBeGreaterThan(0);
  expect(allocated).toBeLessThanOrEqual(72);
  await page.screenshot({path:info.outputPath('p3-d2-hit-fragments-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'重新开始'}).click();
  await page.getByRole('button',{name:'暂停'}).click();
  await expect(stage).toHaveAttribute('data-fx-active','0');
  expect(Number(await stage.getAttribute('data-fx-reusable'))).toBeGreaterThan(0);
  expect(Number(await stage.getAttribute('data-fx-allocated'))).toBeLessThanOrEqual(72);
  await page.setViewportSize({width:390,height:844});
  await expect(stage).toHaveAttribute('data-world-width','36');
  await page.screenshot({path:info.outputPath('p3-d2-combat-portrait.png'),fullPage:true});
  expect(errors).toEqual([]);
});
test('P3/D2：减少动态效果保留规则射击和结果，不额外分配渲染目标',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const textures=await stage.getAttribute('data-gpu-textures');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-fx-emitted'))).toBeGreaterThanOrEqual(2);
  await page.keyboard.up('Space');
  expect(Number(await stage.getAttribute('data-fx-allocated'))).toBeLessThanOrEqual(72);
  await expect(stage).toHaveAttribute('data-gpu-textures',textures??'');
});
