import { test, expect } from '@playwright/test';

test('真实 Three.js 四种模型及低噪音战场：多敌阵/切关/窄屏 GPU 资产数量恒定', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const stage=page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-enemy-kinds','scout');
  await expect(stage).toHaveAttribute('data-enemy-count','24');
  await expect(stage).toHaveAttribute('data-debug-grid','off');
  const gpuAssets=Number(await stage.getAttribute('data-gpu-assets'));
  expect(gpuAssets).toBeGreaterThan(10);
  await page.screenshot({path: info.outputPath('scout-models.png'),fullPage:true});
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(stage).toHaveAttribute('data-enemy-kinds','raider');
  await expect(stage).toHaveAttribute('data-enemy-count','12');
  await expect(stage).toHaveAttribute('data-gpu-assets',String(gpuAssets));
  await page.screenshot({path: info.outputPath('raider-models.png'),fullPage:true});
  await page.route('**/levels/crossfire.json',async route => {
    const response=await route.fetch();
    const json=await response.json();
    json.waves[0].formation.type='guardian';
    await route.fulfill({response,json});
  });
  await page.getByTestId('level-select').selectOption('first-contact');
  await expect(stage).toHaveAttribute('data-enemy-kinds','scout');
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(stage).toHaveAttribute('data-enemy-kinds','guardian');
  await expect(stage).toHaveAttribute('data-gpu-assets',String(gpuAssets));
  await page.screenshot({path: info.outputPath('guardian-models.png'),fullPage:true});
  await page.setViewportSize({width:440,height:780});
  const box=await stage.locator('canvas').boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(420);
  expect(box!.height).toBeGreaterThanOrEqual(710);
  await expect(stage).toHaveAttribute('data-world-width','36');
  await page.screenshot({path: info.outputPath('guardian-narrow-models.png'),fullPage:true});
  expect(errors).toEqual([]);
});
