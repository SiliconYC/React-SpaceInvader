import { test,expect } from '@playwright/test';

test('守卫机两次命中、闪光与得分完全由 JSON 装甲驱动',async ({page},info)=>{
  await page.route('**/levels/crossfire.json',async route=>{
    const response=await route.fetch(), json=await response.json();
    const wave=json.waves[1];
    wave.spawnAtSeconds=0;
    Object.assign(wave.formation,{rows:1,columns:1,startX:18,startY:10});
    wave.movement.horizontalSpeed=0;
    wave.attack.shotsPerMinute=0;
    json.waves=[wave];
    await route.fulfill({response,json});
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByTestId('level-select').selectOption('crossfire');
  const stage=page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-enemy-hp','2');
  await expect(stage).toHaveAttribute('data-enemy-kinds','guardian');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-bullet-count'))).toBeGreaterThan(0);
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-enemy-hp','1',{timeout:6000});
  await expect(page.getByTestId('score')).toContainText('0');
  await expect(stage).toHaveAttribute('data-fx-kind','armor');
  await page.screenshot({path:info.outputPath('guardian-armor.png'),fullPage:true});
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-bullet-count'))).toBeGreaterThan(0);
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-game-phase','won',{timeout:7000});
  await expect(page.getByTestId('score')).toContainText('30');
});
test('袭击机 JSON 双列齐射显示多发敌弹，暂停后不重复生成',async({page},info)=>{
  await page.route('**/levels/crossfire.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:2,startX:12,startY:14});
    json.waves[0].movement.horizontalSpeed=0;
    Object.assign(json.waves[0].attack,{shotsPerMinute:120,projectileSpeed:2});
    await route.fulfill({response,json});
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByTestId('level-select').selectOption('crossfire');
  const stage=page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-enemy-kinds','raider');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect.poll(async()=>Number(await stage.getAttribute('data-enemy-bullet-count')),{timeout:7000}).toBeGreaterThanOrEqual(2);
  await page.getByRole('button',{name:'暂停'}).click();
  const bullets=await stage.getAttribute('data-enemy-bullet-count');
  await page.waitForTimeout(250);
  await expect(stage).toHaveAttribute('data-enemy-bullet-count',bullets??'2');
  await page.screenshot({path:info.outputPath('raider-volley.png'),fullPage:true});
});
