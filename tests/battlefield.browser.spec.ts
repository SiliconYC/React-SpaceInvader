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

test('方向键与 A/D 持续移动，双键抵消、松开停止，暂停失焦释放', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const field = page.getByTestId('battlefield');
  const x = async () => Number(await field.getAttribute('data-player-x'));
  const y = await field.getAttribute('data-player-y');
  const startX = await x();
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.keyboard.down('ArrowLeft');
  await expect.poll(x).toBeLessThan(startX - 0.4);
  await page.keyboard.down('d');
  const mixedX = await x();
  await page.waitForTimeout(160);
  expect(Math.abs(await x() - mixedX)).toBeLessThan(0.5);
  await page.keyboard.up('d');
  await expect.poll(x).toBeLessThan(mixedX - 0.4);
  await page.keyboard.up('ArrowLeft');
  const stoppedX = await x();
  await page.waitForTimeout(170);
  expect(Math.abs(await x() - stoppedX)).toBeLessThan(0.3);
  await page.keyboard.down('ArrowRight');
  await expect.poll(x).toBeGreaterThan(stoppedX + 0.4);
  await page.getByRole('button', { name: '暂停' }).click();
  const pausedX = await x();
  await page.waitForTimeout(140);
  expect(Math.abs(await x() - pausedX)).toBeLessThan(0.3);
  await page.keyboard.up('ArrowRight');
  await page.getByRole('button', { name: '继续' }).click();
  await page.waitForTimeout(170);
  expect(Math.abs(await x() - pausedX)).toBeLessThan(0.3);
  await page.keyboard.down('a');
  await expect.poll(x).toBeLessThan(pausedX - 0.4);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const blurredX = await x();
  await page.waitForTimeout(170);
  expect(Math.abs(await x() - blurredX)).toBeLessThan(0.3);
  await page.keyboard.up('a');
  expect(await field.getAttribute('data-player-y')).toBe(y);
  await page.setViewportSize({ width: 480, height: 760 });
  expect(await field.getAttribute('data-player-y')).toBe(y);
  await page.getByRole('button', { name: '重置' }).click();
  await expect.poll(x).toBe(18);
});

test('游戏飞船始终受二维边界约束，页面包含实际三维模型', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-player-x', '18.0000');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1900);
  await page.keyboard.up('ArrowRight');
  const x = Number(await page.getByTestId('battlefield').getAttribute('data-player-x'));
  expect(x).toBeGreaterThan(18);
  expect(x).toBeLessThanOrEqual(36 - 1.25);
});

test('真实关卡 JSON 加载并渲染 24 架静态敌机，且不会随时间自行移动', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(page.getByTestId('level-name')).toHaveText('第一关 · 初次接触');
  const stage = page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-enemy-count', '24');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.waitForTimeout(260);
  await expect(stage).toHaveAttribute('data-enemy-count', '24');
  expect(errors).toEqual([]);
});

test('改变下载的 JSON 阵列不修改 TypeScript，渲染数量随之变化', async ({ page }) => {
  await page.route('**/levels/first-contact.json', async route => {
    const original = await route.fetch();
    const level = await original.json();
    level.waves[0].formation.columns = 5;
    level.metadata.name = '临时阵列测试';
    await route.fulfill({ response: original, json: level });
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(page.getByTestId('level-name')).toHaveText('临时阵列测试');
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-enemy-count', '15');
});

test('无效关卡拒绝渲染且明确显示中文错误，不静默回退', async ({ page }) => {
  await page.route('**/levels/first-contact.json', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ schemaVersion: 999 }) }));
  await page.goto('./');
  await expect(page.getByTestId('level-error')).toContainText('关卡数据无效');
  await expect(page.getByTestId('level-error')).toContainText('schemaVersion');
  await expect(page.getByRole('button', { name: '开始', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('battlefield').locator('canvas')).toHaveCount(0);
});
