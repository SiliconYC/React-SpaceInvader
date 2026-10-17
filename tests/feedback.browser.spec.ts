import { test,expect } from '@playwright/test';

test('真实 WebGL 视觉事件仅来自规则：开局、射击、击中、终局、复位、暂停',async ({page},info)=>{
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch();
    const json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:10});
    json.waves[0].movement.horizontalSpeed=0;
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const stage=page.getByTestId('battlefield');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect.poll(async()=>Number(await stage.getAttribute('data-fx-emitted'))).toBeGreaterThanOrEqual(1);
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-fx-emitted'))).toBeGreaterThanOrEqual(2);
  await expect.poll(async()=>stage.getAttribute('data-fx-kind'),{timeout:7000}).toBe('finish');
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-game-phase','won');
  await expect(page.getByTestId('score')).toContainText('10');
  const maxActive=Number(await stage.getAttribute('data-fx-active'));
  expect(maxActive).toBeLessThanOrEqual(72);
  await page.screenshot({path:info.outputPath('fx-win.png'),fullPage:true});
  await page.getByRole('button',{name:'重新开始'}).click();
  await expect(stage).toHaveAttribute('data-game-phase','running');
  // Reset clears event history and old effects; new START triggers precisely one fresh wave event.
  await expect(stage).toHaveAttribute('data-fx-kind','wave');
  await page.getByRole('button',{name:'暂停'}).click();
  await expect(stage).toHaveAttribute('data-fx-active','0');
  await page.getByRole('button',{name:'重置'}).click();
  await expect(stage).toHaveAttribute('data-fx-active','0');
  expect(errors).toEqual([]);
});
test('玩家受击与敌机击毁具不同颜色形状反馈且无无限资源增长',async ({page},info)=>{
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch();
    const json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:10});
    json.waves[0].movement.horizontalSpeed=0;
    Object.assign(json.waves[0].attack,{shotsPerMinute:240,projectileSpeed:25});
    await route.fulfill({response,json});
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const stage=page.getByTestId('battlefield');
  const assets=await stage.getAttribute('data-gpu-assets');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect.poll(async()=>Number(await stage.getAttribute('data-lives')),{timeout:9000}).toBeLessThan(3);
  // A subsequent game-finished event may correctly replace the last effect with 'defeat'.
  // Assert the authoritative damage feedback was emitted, not that it stayed last.
  await expect.poll(async()=>Number(await stage.getAttribute('data-fx-damage-events'))).toBeGreaterThanOrEqual(1);
  await page.screenshot({path:info.outputPath('fx-hit.png'),fullPage:true});
  await expect.poll(async()=>Number(await stage.getAttribute('data-fx-active')),{timeout:2000}).toBeLessThanOrEqual(72);
  await expect(stage).toHaveAttribute('data-gpu-assets',assets ?? '');
  await page.getByRole('button',{name:'重置'}).click();
  await expect(stage).toHaveAttribute('data-fx-active','0');
});
