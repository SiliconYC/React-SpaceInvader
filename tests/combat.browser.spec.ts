import { test, expect } from '@playwright/test';

test('空格长按击毁 JSON 指定的敌机，分数即时增加，暂停不能开火', async ({ page }) => {
  await page.route('**/levels/first-contact.json', async route => {
    const original = await route.fetch();
    const level = await original.json();
    level.waves[0].formation.rows = 1;
    level.waves[0].formation.columns = 1;
    level.waves[0].formation.startX = 18;
    level.waves[0].formation.startY = 10;
    level.waves[0].movement.horizontalSpeed = 0;
    await route.fulfill({ response: original, json: level });
  });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(page.getByTestId('score')).toContainText('0');
  const stage = page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-enemy-count', '1');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.keyboard.down('Space');
  await expect.poll(async () => Number(await stage.getAttribute('data-bullet-count'))).toBeGreaterThan(0);
  await expect.poll(async () => Number(await stage.getAttribute('data-score')), { timeout: 8000 }).toBe(10);
  await expect(stage).toHaveAttribute('data-enemy-count', '0');
  await page.keyboard.up('Space');
  await expect(page.getByTestId('score')).toContainText('10');
  await expect(page.getByTestId('game-result')).toContainText('胜利');
  await page.getByRole('button', { name: '重新开始' }).click();
  await expect(stage).toHaveAttribute('data-enemy-count', '1');
  await page.getByRole('button', { name: '暂停' }).click();
  const bullets = await stage.getAttribute('data-bullet-count');
  await page.keyboard.down('Space');
  await page.waitForTimeout(210);
  await expect(stage).toHaveAttribute('data-bullet-count', bullets ?? '0');
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: '重置' }).click();
  await expect(stage).toHaveAttribute('data-enemy-count', '1');
  await expect(page.getByTestId('score')).toContainText('0');
  expect(errors).toEqual([]);
});

test('空格释放后停止连发，游戏保持简洁大画布', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const stage = page.getByTestId('battlefield');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  await page.keyboard.up('Space');
  await expect.poll(async () => Number(await stage.getAttribute('data-bullet-count'))).toBeGreaterThan(0);
  await page.getByRole('button', { name: '暂停' }).click();
  const pausedCount = await stage.getAttribute('data-bullet-count');
  await page.waitForTimeout(170);
  await expect(stage).toHaveAttribute('data-bullet-count', pausedCount ?? '0');
  await page.getByRole('button', { name: '继续' }).click();
  await page.waitForTimeout(120);
  // 继续后未重新按下空格，不应产生额外子弹。
  const count = Number(await stage.getAttribute('data-bullet-count'));
  expect(count).toBeLessThanOrEqual(Number(pausedCount));
  const viewport = page.viewportSize(), box = await stage.locator('canvas').boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(viewport!.width * 0.95);
});
