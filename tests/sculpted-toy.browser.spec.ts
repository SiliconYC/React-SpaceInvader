import {test,expect} from '@playwright/test';

test('玩具材质反射在真实 WebGL 上下文恢复后仍保持同一画面',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage).toHaveAttribute('data-studio-environment','loaded');
  const before=await stage.locator('canvas').screenshot({path:info.outputPath('toy-reflection-before-loss.png')});
  const available=await page.evaluate(()=>{
    const gl=document.querySelector('canvas')?.getContext('webgl2');
    const loss=gl?.getExtension('WEBGL_lose_context');
    (window as unknown as {toyLoss:typeof loss}).toyLoss=loss;
    if(!loss)return false;loss.loseContext();return true;
  });
  test.skip(!available,'软件 Chromium 没有上下文丢失扩展');
  await expect(stage).toHaveAttribute('data-webgl-context','lost');
  await page.evaluate(()=>(window as unknown as {toyLoss:{restoreContext():void}}).toyLoss.restoreContext());
  await expect(stage).toHaveAttribute('data-webgl-context','ready',{timeout:12000});
  await expect(stage).toHaveAttribute('data-studio-environment','loaded');
  const after=await stage.locator('canvas').screenshot({path:info.outputPath('toy-reflection-restored.png')});
  expect(after.equals(before),'静止场景恢复后不能丢失环境反射或材质').toBe(true);
});

test('反射图加载失败仍可开始、移动和暂停',async({page})=>{
  await page.route('**/art/studio-cubeuv.png',route=>route.abort());
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage).toHaveAttribute('data-studio-environment','fallback');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  const x=Number(await stage.getAttribute('data-player-x'));
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async()=>Number(await stage.getAttribute('data-player-x'))).toBeLessThan(x);
  await page.keyboard.up('ArrowLeft');
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await expect(stage).toHaveAttribute('data-game-phase','paused');
});
