import { test, expect } from '@playwright/test';

test('浏览器实玩胜利：开始、移动、击毁、得分、终局拒绝操作、重玩', async ({ page }) => {
  await page.route('**/levels/first-contact.json', async route => {
    const response = await route.fetch();
    const level = await response.json();
    Object.assign(level.waves[0].formation, { rows: 1, columns: 1, startX: 18, startY: 10 });
    level.waves[0].movement.horizontalSpeed = 0;
    level.waves[0].attack.shotsPerMinute = 0;
    await route.fulfill({ response, json: level });
  });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const stage = page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-enemy-count', '1');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => Number(await stage.getAttribute('data-player-x'))).toBeLessThan(17.4);
  await page.keyboard.up('ArrowLeft');
  // 实际键盘移动已验证；重置到确定的初始瞄准点，避免异步轮询导致飞船越过目标。
  await page.getByRole('button', { name: '重置' }).click();
  await expect(stage).toHaveAttribute('data-player-x', '18.0000');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.keyboard.down('Space');
  await expect.poll(async () => Number(await stage.getAttribute('data-score')), { timeout: 8000 }).toBe(10);
  await page.keyboard.up('Space');
  await expect(page.getByTestId('game-result')).toContainText('胜利');
  await expect(stage).toHaveAttribute('data-game-phase', 'won');
  await expect(stage).toHaveAttribute('data-enemy-count', '0');
  await expect(page.getByTestId('lives')).toContainText('3');
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await expect(stage).toHaveAttribute('data-bullet-count', '0');
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: '重新开始' }).click();
  await expect(stage).toHaveAttribute('data-game-phase', 'running');
  await expect(stage).toHaveAttribute('data-enemy-count', '1');
  await expect(page.getByTestId('score')).toContainText('0');
  expect(errors).toEqual([]);
});

test('浏览器实玩受袭失败：可见敌弹、生命递减、失败、重新开始', async ({ page }) => {
  await page.route('**/levels/first-contact.json', async route => {
    const response = await route.fetch();
    const level = await response.json();
    Object.assign(level.waves[0].formation, { rows: 1, columns: 1, startX: 18, startY: 10 });
    level.waves[0].movement.horizontalSpeed = 0;
    Object.assign(level.waves[0].attack, { shotsPerMinute: 240, projectileSpeed: 12 });
    await route.fulfill({ response, json: level });
  });
  const stageError: string[] = [];
  page.on('pageerror', e => stageError.push(e.message));
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const stage = page.getByTestId('battlefield');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect.poll(async () => Number(await stage.getAttribute('data-enemy-bullet-count')),
    { timeout: 8000 }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await stage.getAttribute('data-lives')),
    { timeout: 8000 }).toBeLessThan(3);
  await expect.poll(async () => stage.getAttribute('data-game-phase'),
    { timeout: 12000 }).toBe('lost');
  await expect(page.getByTestId('game-result')).toContainText('飞船已被击毁');
  await expect(page.getByTestId('lives')).toContainText('0');
  await page.getByRole('button', { name: '重新开始' }).click();
  await expect(stage).toHaveAttribute('data-game-phase', 'running');
  await expect(page.getByTestId('lives')).toContainText('3');
  await page.getByRole('button', { name: '暂停' }).click();
  await expect(page.getByTestId('pause-message')).toHaveText('已暂停');
  const ticks = await page.getByTestId('battlefield').getAttribute('data-enemy-first-x');
  const lives = await stage.getAttribute('data-lives');
  await page.waitForTimeout(210);
  await expect(stage).toHaveAttribute('data-enemy-first-x', ticks ?? '');
  await expect(stage).toHaveAttribute('data-lives', lives ?? '3');
  await page.getByRole('button', { name: '继续' }).click();
  await expect(page.getByTestId('pause-message')).toHaveCount(0);
  expect(stageError).toEqual([]);
});

test('浏览器防线失守可结算，无需依赖敌方子弹', async ({ page }) => {
  await page.route('**/levels/first-contact.json', async route => {
    const response = await route.fetch();
    const level = await response.json();
    Object.assign(level.waves[0].formation, { rows: 1, columns: 1, startX: 18, startY: 12 });
    Object.assign(level.waves[0].movement,
      { horizontalSpeed: 40, descentPerTurn: 25, moveEveryTicks: 1 });
    level.waves[0].attack.shotsPerMinute = 0;
    await route.fulfill({ response, json: level });
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect.poll(async () => page.getByTestId('battlefield').getAttribute('data-outcome'),
    { timeout: 8000 }).toBe('line-breached');
  await expect(page.getByTestId('game-result')).toContainText('防线失守');
  await page.getByRole('button', { name: '重新开始' }).click();
  await expect(page.getByTestId('game-result')).toHaveCount(0);
});
