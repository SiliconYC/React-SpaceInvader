import { test, expect } from '@playwright/test';

test('真实 Chromium 初始化 Three.js 网格，响应缩放而保持二维战场坐标', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push('资源失败：' + request.url()));
  const response = await page.goto('./');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const battlefield = page.getByTestId('battlefield');
  const canvas = battlefield.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-renderer', 'threejs');
  await expect(battlefield).toHaveAttribute('data-world-width', '24');
  await expect(battlefield).toHaveAttribute('data-world-height', '32');
  const sizeBefore = await canvas.evaluate(element => ({ width: element.width, height: element.height }));
  expect(sizeBefore.width).toBeGreaterThan(100);
  expect(sizeBefore.height).toBeGreaterThan(100);
  const spanBefore = await battlefield.getAttribute('data-camera-span-x');
  await page.setViewportSize({ width: 480, height: 750 });
  await expect.poll(() => battlefield.getAttribute('data-camera-span-x')).not.toBe(spanBefore);
  await expect(battlefield).toHaveAttribute('data-world-width', '24');
  await expect(battlefield).toHaveAttribute('data-world-height', '32');
  expect(errors).toEqual([]);
});

test('命令按钮只改变引擎状态，暂停时逻辑步数不前进', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button', { name: '启动时钟' }).click();
  await expect(page.getByTestId('game-phase')).toHaveText('运行中');
  await expect.poll(async () => Number(await page.getByTestId('tick').innerText())).toBeGreaterThan(0);
  await page.getByRole('button', { name: '暂停' }).click();
  await expect(page.getByTestId('game-phase')).toHaveText('已暂停');
  const tick = await page.getByTestId('tick').innerText();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('tick')).toHaveText(tick);
  await page.getByRole('button', { name: '继续' }).click();
  await expect.poll(async () => Number(await page.getByTestId('tick').innerText())).toBeGreaterThan(Number(tick));
  await page.getByRole('button', { name: '重置' }).click();
  await expect(page.getByTestId('game-phase')).toHaveText('待启动');
  await expect(page.getByTestId('tick')).toHaveText('0');
});
