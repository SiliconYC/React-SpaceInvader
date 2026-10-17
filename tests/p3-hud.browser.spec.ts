import { test,expect } from '@playwright/test';

test('P3/D3 桌面：全画布、轻量 HUD、可用关卡/音频/成绩/暂停/重置',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  const canvas=page.getByTestId('battlefield').locator('canvas');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const view=page.viewportSize()!,box=await canvas.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(view.width*.95);
  expect(box!.height).toBeGreaterThanOrEqual(view.height*.95);
  const life=page.getByTestId('lives');
  await expect(life).toContainText('3');
  await expect(life.locator('svg.life-ship')).toHaveCount(1);
  await page.screenshot({path:info.outputPath('p3-d3-hud-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'音频'}).click();
  await expect(page.getByLabel('背景音乐')).toBeVisible();
  await page.getByRole('button',{name:'音频'}).click();
  await page.getByRole('button',{name:'成绩',exact:true}).click();
  await expect(page.getByRole('region',{name:'本机排行榜'})).toBeVisible();
  await page.getByRole('button',{name:'成绩',exact:true}).click();
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-total-waves','2');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(page.locator('.control-hint')).toHaveCount(0);
  await page.getByRole('button',{name:'暂停'}).click();
  await expect(page.getByTestId('pause-message')).toBeVisible();
  await page.getByRole('button',{name:'继续'}).click();
  await page.getByRole('button',{name:'重置'}).click();
  expect(errors).toEqual([]);
});

test.describe('P3/D3 移动端安全布局',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  test('竖屏/横屏不重叠战斗按钮，保留双手触控与全画布',async({page},info)=>{
    await page.goto('./');
    const stage=page.getByTestId('battlefield');
    await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
    const layout=async()=>{
      const header=(await page.locator('.game-header').boundingBox())!;
      const stats=(await page.locator('.score-hud').boundingBox())!;
      const play=(await page.locator('.play-actions').boundingBox())!;
      const touch=(await page.locator('.touch-controls').boundingBox())!;
      const canvas=(await stage.locator('canvas').boundingBox())!;
      return {header,stats,play,touch,canvas};
    };
    await expect(page.getByTestId('touch-left')).toBeVisible();
    let l=await layout();
    expect(l.stats.y).toBeGreaterThanOrEqual(l.header.y+l.header.height-2);
    expect(l.play.y+l.play.height).toBeLessThanOrEqual(l.touch.y+3);
    expect(l.canvas.width).toBeGreaterThanOrEqual(380);
    await page.screenshot({path:info.outputPath('p3-d3-hud-portrait.png'),fullPage:true});
    await page.getByRole('button',{name:'开始',exact:true}).tap();
    await expect(page.getByTestId('touch-fire')).toBeEnabled();
    await page.getByRole('button',{name:'暂停'}).tap();
    await expect(page.getByTestId('touch-left')).toBeDisabled();
    await page.getByRole('button',{name:'继续'}).tap();
    await page.setViewportSize({width:844,height:390});
    l=await layout();
    expect(l.stats.y).toBeGreaterThanOrEqual(l.header.y+l.header.height-2);
    expect(l.play.y+l.play.height).toBeLessThanOrEqual(l.touch.y+3);
    expect(l.canvas.width).toBeGreaterThanOrEqual(830);
    await page.screenshot({path:info.outputPath('p3-d3-hud-landscape.png'),fullPage:true});
    await page.getByRole('button',{name:'重置'}).tap();
    await expect(stage).toHaveAttribute('data-world-width','36');
  });
});
