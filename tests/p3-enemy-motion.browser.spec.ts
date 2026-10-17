import {test,expect} from '@playwright/test';

test('P3/B4: 24+ 敌机逐 ID 相位运行、暂停冻结、折返和重置无残留',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');const field=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(field).toHaveAttribute('data-enemy-count','24');
  const calls=Number(await field.getAttribute('data-draw-calls'));
  expect(calls).toBeLessThan(65);
  await page.getByRole('button',{name:'开始',exact:true}).click();
  const initial=await field.getAttribute('data-enemy-visual-roll');
  await expect.poll(()=>field.getAttribute('data-enemy-visual-roll')).not.toBe(initial);
  await page.screenshot({path:info.outputPath('p3-b4-scout-inflight.png'),fullPage:true});
  await page.getByRole('button',{name:'暂停'}).click();
  const frozen=await field.getAttribute('data-enemy-visual-roll');
  await page.waitForTimeout(210);
  expect(await field.getAttribute('data-enemy-visual-roll')).toBe(frozen);
  await page.getByRole('button',{name:'重置'}).click();
  await expect(field).toHaveAttribute('data-enemy-visual-roll','0.00000');
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(field).toHaveAttribute('data-enemy-kinds','raider');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.waitForTimeout(280);
  await page.screenshot({path:info.outputPath('p3-b4-raider-inflight.png'),fullPage:true});
  expect(Number(await field.getAttribute('data-draw-calls'))).toBeLessThan(65);
  expect(errors).toEqual([]);
});
test('P3/B4: 守卫机独立缓慢旋转；减少动态效果时三种敌机无姿态动画',async({page},info)=>{
  await page.route('**/levels/crossfire.json',async route=>{
    const response=await route.fetch();const json=await response.json();
    json.waves[0].formation.type='guardian';
    await route.fulfill({response,json});
  });
  await page.goto('./');
  await page.getByTestId('level-select').selectOption('crossfire');
  const stage=page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-enemy-kinds','guardian');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.waitForTimeout(450);
  expect(Math.abs(Number(await stage.getAttribute('data-enemy-visual-roll')))).toBeLessThan(.04);
  await page.screenshot({path:info.outputPath('p3-b4-guardian-inflight.png'),fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(stage).toHaveAttribute('data-enemy-visual-roll','0.00000');
  await expect(stage).toHaveAttribute('data-enemy-visual-yaw','0.00000');
});
