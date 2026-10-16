import { test,expect } from '@playwright/test';

test('真实网页通关自动记分，仅保存一次；刷新可见、可删除并确认',async({page})=>{
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch();const json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:10});
    json.waves[0].movement.horizontalSpeed=0;
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  await page.goto('./');
  await page.getByRole('button',{name:'成绩'}).click();
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(0);
  await page.getByRole('button',{name:'成绩'}).click();
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  await expect(page.getByTestId('game-result')).toContainText('胜利',{timeout:9000});
  await page.keyboard.up('Space');
  await expect(page.getByTestId('local-best')).toContainText('10');
  await page.getByRole('button',{name:'成绩'}).click();
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('score-list')).toContainText('通关');
  await page.waitForTimeout(240);
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'成绩'}).click();
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(1);
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'清空本机成绩'}).click();
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(1);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'清空本机成绩'}).click();
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button',{name:'成绩'}).click();
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(0);
});

test('两关独立保存胜负；未完成重置不得伪造结算',async({page})=>{
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch();const json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:10});
    json.waves[0].movement.horizontalSpeed=0;
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  await page.route('**/levels/crossfire.json',async route=>{
    const response=await route.fetch();const json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:12});
    Object.assign(json.waves[0].movement,{horizontalSpeed:40,descentPerTurn:25,moveEveryTicks:1});
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  await page.goto('./');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.getByRole('button',{name:'重置'}).click();
  await page.getByRole('button',{name:'成绩'}).click();
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(0);
  await page.getByRole('button',{name:'成绩'}).click();
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  await expect(page.getByTestId('game-result')).toContainText('胜利',{timeout:9000});
  await page.keyboard.up('Space');
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-total-waves','2');
  await page.getByRole('button',{name:'成绩'}).click();
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(0);
  await page.getByRole('button',{name:'成绩'}).click();
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-game-phase','lost',{timeout:9000});
  await page.getByRole('button',{name:'成绩'}).click();
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('score-list')).toContainText('失败');
  await page.getByTestId('level-select').selectOption('first-contact');
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('score-list')).toContainText('通关');
});

test('本地成绩损坏与存储权限拒绝时游戏无障碍继续运行',async({page})=>{
  await page.addInitScript(()=>{
    window.localStorage.setItem('react-space-invader.scores.v1','{malformed');
  });
  await page.goto('./');
  await page.getByRole('button',{name:'成绩'}).click();
  await expect(page.getByTestId('score-list').locator('li')).toHaveCount(0);
  await page.getByRole('button',{name:'成绩'}).click();
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-game-phase','running');
});

test('Storage API getter throws: still starts, plays, and does not crash',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('disabled');}});
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-game-phase','running');
  await page.getByRole('button',{name:'暂停'}).click();
  await expect(page.getByTestId('pause-message')).toBeVisible();
});
