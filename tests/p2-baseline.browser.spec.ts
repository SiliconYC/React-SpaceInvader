import { test, expect } from '@playwright/test';

test('P2 线上基线：未经替换的真实两关、操作、静态资源、全屏截图', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const remote: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', req => errors.push(req.url()));
  page.on('response', res => {
    if (res.status() >= 400) errors.push(res.status() + ': ' + res.url());
  });
  page.on('request', req => {
    if (!new URL(req.url()).origin.startsWith(new URL(testInfo.project.use.baseURL as string).origin)) {
      remote.push(req.url());
    }
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const field = page.getByTestId('battlefield');
  await expect(field).toHaveAttribute('data-enemy-count', '24');
  await expect(field).toHaveAttribute('data-total-waves', '1');
  await expect(page.getByTestId('level-select').locator('option')).toHaveCount(2);
  const desktop = await field.locator('canvas').boundingBox();
  const screen = page.viewportSize();
  expect(desktop!.width).toBeGreaterThan(screen!.width * .95);
  expect(desktop!.height).toBeGreaterThan(screen!.height * .9);
  await page.screenshot({ path: testInfo.outputPath('desktop-baseline.png'), fullPage: true });

  await page.getByRole('button', {name:'开始',exact:true}).click();
  const x0 = Number(await field.getAttribute('data-player-x'));
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async()=>Number(await field.getAttribute('data-player-x'))).toBeLessThan(x0 - .3);
  await page.keyboard.up('ArrowLeft');
  const x1 = Number(await field.getAttribute('data-player-x'));
  await page.waitForTimeout(160);
  expect(Math.abs(Number(await field.getAttribute('data-player-x'))-x1)).toBeLessThan(.3);
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await field.getAttribute('data-bullet-count'))).toBeGreaterThan(0);
  await page.keyboard.up('Space');
  await page.getByRole('button',{name:'暂停'}).click();
  await expect(page.getByTestId('pause-message')).toBeVisible();
  await page.getByRole('button',{name:'重置'}).click();
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(field).toHaveAttribute('data-enemy-count','12');
  await expect(field).toHaveAttribute('data-total-waves','2');
  await expect(page.getByTestId('level-name')).toHaveText('第二关 · 交叉火力');
  await page.setViewportSize({width:440,height:780});
  const narrow = await field.locator('canvas').boundingBox();
  expect(narrow!.width).toBeGreaterThan(420);
  expect(narrow!.height).toBeGreaterThan(710);
  await page.screenshot({ path: testInfo.outputPath('narrow-baseline.png'), fullPage: true });
  await expect(field).toHaveAttribute('data-world-width','36');
  await expect(field).toHaveAttribute('data-world-height','24');
  expect(remote).toEqual([]);
  expect(errors).toEqual([]);
});
