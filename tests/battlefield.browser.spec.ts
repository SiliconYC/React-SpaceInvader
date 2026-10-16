import { test, expect } from '@playwright/test';

test('全屏三维画布、默认极简且响应缩放不改变二维规则坐标', async ({ page }) => {
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
  await expect(battlefield).toHaveAttribute('data-world-width', '36');
  await expect(battlefield).toHaveAttribute('data-world-height', '24');
  await expect(battlefield).toHaveAttribute('data-debug-grid', 'off');
  await expect(page.getByTestId('debug-panel')).toHaveCount(0);
  await expect(page.getByText('REACT / THREE.JS')).toHaveCount(0);
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(viewport!.width * 0.95);
  expect(box!.height).toBeGreaterThanOrEqual(viewport!.height * 0.9);
  const spanBefore = await battlefield.getAttribute('data-camera-span-x');
  await page.setViewportSize({ width: 480, height: 750 });
  await expect.poll(() => battlefield.getAttribute('data-camera-span-x')).not.toBe(spanBefore);
  await expect(battlefield).toHaveAttribute('data-world-width', '36');
  await expect(battlefield).toHaveAttribute('data-world-height', '24');
  const resized = await canvas.boundingBox();
  expect(resized!.width).toBeGreaterThanOrEqual(456);
  expect(resized!.height).toBeGreaterThanOrEqual(675);
  expect(errors).toEqual([]);
});

test('调试信息和网格默认隐藏，需要主动切换', async ({ page }) => {
  await page.goto('./');
  const battlefield = page.getByTestId('battlefield');
  await expect(battlefield).toHaveAttribute('data-debug-grid', 'off');
  await page.getByRole('button', { name: '调试' }).click();
  await expect(page.getByTestId('debug-panel')).toBeVisible();
  await expect(battlefield).toHaveAttribute('data-debug-grid', 'on');
  await expect(page.getByTestId('debug-panel')).toContainText('36 × 24');
  await page.getByRole('button', { name: '关闭调试' }).click();
  await expect(page.getByTestId('debug-panel')).toHaveCount(0);
  await expect(battlefield).toHaveAttribute('data-debug-grid', 'off');
});

test('状态按钮不干扰规则时钟，暂停时逻辑步数不前进', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button', { name: '调试' }).click();
  await page.getByRole('button', { name: '开始', exact: true }).click();
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
