import { test, expect } from '@playwright/test';

test('真实浏览器从清单选择两份不同 JSON 关卡，显示真实编队、波次与说明', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', req => errors.push(req.url()));
  const response = await page.goto('./');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const stage = page.getByTestId('battlefield');
  const select = page.getByTestId('level-select');
  await expect(select.locator('option')).toHaveCount(2);
  await expect(page.getByTestId('level-name')).toHaveText('第一关 · 初次接触');
  await expect(stage).toHaveAttribute('data-enemy-count', '24');
  await expect(stage).toHaveAttribute('data-total-waves', '1');
  await select.selectOption('crossfire');
  await expect(page.getByTestId('level-name')).toHaveText('第二关 · 交叉火力');
  await expect(page.getByTestId('level-description')).toContainText('双波次');
  await expect(stage).toHaveAttribute('data-total-waves', '2');
  await expect(stage).toHaveAttribute('data-enemy-count', '12');
  await expect(page.getByTestId('wave-status')).toContainText('1/2');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect(select).toBeDisabled();
  await page.getByRole('button', { name: '暂停' }).click();
  await expect(page.getByTestId('pause-message')).toHaveText('已暂停');
  await page.getByRole('button', { name: '继续' }).click();
  await expect(page.getByTestId('pause-message')).toHaveCount(0);
  await page.getByRole('button', { name: '重置' }).click();
  await expect(select).toBeEnabled();
  await expect(stage).toHaveAttribute('data-wave', '1');
  await expect(stage).toHaveAttribute('data-enemy-count', '12');
  expect(errors).toEqual([]);
});

test('浏览器完整多波战斗：人工射击清场、等待调度、第二波、通关、重玩与切换', async ({ page }) => {
  // 只更换交战数值，不注入获胜状态，也不调用内部引擎作弊。
  await page.route('**/levels/crossfire.json', async route => {
    const response = await route.fetch();
    const level = await response.json();
    for (let index = 0; index < level.waves.length; index++) {
      const wave = level.waves[index];
      wave.formation.rows = 1;
      wave.formation.columns = 1;
      wave.formation.startX = 18;
      wave.formation.startY = 10;
      wave.movement.horizontalSpeed = 0;
      if (index === 1) wave.behavior.armorHits = 1; // 此用例只测跨波调度，装甲独立测
      wave.attack.shotsPerMinute = 0;
    }
    level.waves[1].spawnAtSeconds = 2;
    await route.fulfill({ response, json: level });
  });
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('requestfailed', req => problems.push(req.url()));
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByTestId('level-select').selectOption('crossfire');
  const stage = page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-total-waves', '2');
  await expect(stage).toHaveAttribute('data-enemy-count', '1');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.keyboard.down('Space');
  await expect(stage).toHaveAttribute('data-waiting-for-wave', 'true', { timeout: 7000 });
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-pending-waves', '1');
  await expect(page.getByTestId('score')).toContainText('20');
  await expect(page.getByTestId('wave-wait')).toContainText('下一波');
  await page.getByRole('button', { name: '暂停' }).click();
  const waitingTick = await page.getByTestId('battlefield').getAttribute('data-wave');
  await page.waitForTimeout(160);
  await expect(stage).toHaveAttribute('data-wave', waitingTick ?? '1');
  await page.getByRole('button', { name: '继续' }).click();
  await expect(stage).toHaveAttribute('data-wave', '2', { timeout: 8000 });
  await expect(stage).toHaveAttribute('data-enemy-count', '1');
  await expect(stage).toHaveAttribute('data-pending-waves', '0');
  await expect(page.getByTestId('wave-status')).toContainText('2/2');
  await page.keyboard.down('Space');
  await expect(stage).toHaveAttribute('data-game-phase', 'won', { timeout: 8000 });
  await page.keyboard.up('Space');
  await expect(page.getByTestId('score')).toContainText('50');
  await expect(page.getByTestId('game-result')).toContainText('胜利');
  await page.getByRole('button', { name: '重新开始' }).click();
  await expect(stage).toHaveAttribute('data-wave', '1');
  await expect(stage).toHaveAttribute('data-enemy-count', '1');
  await expect(page.getByTestId('score')).toContainText('0');
  await page.getByRole('button', { name: '重置' }).click();
  await page.getByTestId('level-select').selectOption('first-contact');
  await expect(stage).toHaveAttribute('data-total-waves', '1');
  await expect(stage).toHaveAttribute('data-enemy-count', '24');
  expect(problems).toEqual([]);
});

test('非法切换关卡明确报错，旧规则状态与 Three.js 画布不被破坏', async ({ page }) => {
  await page.route('**/levels/crossfire.json', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({schemaVersion: 97}) }));
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const stage = page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-enemy-count', '24');
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(page.getByTestId('level-error')).toContainText('schemaVersion');
  await expect(stage).toHaveAttribute('data-enemy-count', '24');
  await expect(stage.locator('canvas')).toHaveCount(1);
  await page.getByTestId('level-select').selectOption('first-contact');
  await expect(page.getByTestId('level-error')).toHaveCount(0);
  await expect(stage).toHaveAttribute('data-enemy-count', '24');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect(stage).toHaveAttribute('data-game-phase', 'running');
});

test('非法关卡清单显示可诊断中文错误且不展示伪造敌阵', async ({ page }) => {
  await page.route('**/levels/index.json', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({schemaVersion: 1, levels: []}) }));
  await page.goto('./');
  await expect(page.getByTestId('level-error')).toContainText('关卡数据无效');
  await expect(page.getByTestId('battlefield').locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始', exact: true })).toHaveCount(0);
});

test('静态资源使用 GitHub Pages 子目录、无第三方运行时资源', async ({ page }) => {
  const external: string[] = [];
  const failed: string[] = [];
  page.on('request', req => {
    if (!req.url().startsWith('http://127.0.0.1:4173/React-SpaceInvader/') &&
        !req.url().startsWith('https://siliconyc.github.io/React-SpaceInvader/')) external.push(req.url());
  });
  page.on('response', response => {
    if (response.status() >= 400) failed.push(response.url() + ' (' + response.status() + ')');
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
});
