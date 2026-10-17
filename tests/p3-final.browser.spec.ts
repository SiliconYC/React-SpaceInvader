import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('P3/E2 1920×1080 与宽屏：真实银河/3D模型/HUD 及同源资源',async({page},info)=>{
  test.setTimeout(90000);
  const errors:string[]=[],remote:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',res=>{if(res.status()>=400)errors.push(res.status()+' '+res.url());});
  page.on('request',req=>{
    if(new URL(req.url()).origin!==new URL(info.project.use.baseURL as string).origin)remote.push(req.url());
  });
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage).toHaveAttribute('data-galaxy','loaded');
  await expect(stage).toHaveAttribute('data-planet-meshes','2');
  await expect(stage).toHaveAttribute('data-asteroid-batches','5');
  await expect(stage).toHaveAttribute('data-foreground-count','2');
  await expect(stage).toHaveAttribute('data-debug-grid','off');
  await expect(page.getByTestId('debug-panel')).toHaveCount(0);
  await expect(stage).toHaveAttribute('data-world-width','36');
  await expect(stage).toHaveAttribute('data-world-height','24');
  let box=await stage.locator('canvas').boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(1900);
  expect(box!.height).toBeGreaterThanOrEqual(1060);
  await page.screenshot({path:info.outputPath('p3-final-1080p-live-three.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  box=await stage.locator('canvas').boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(1420);
  await page.screenshot({path:info.outputPath('p3-final-wide-live-three.png'),fullPage:true});
  expect(remote).toEqual([]);expect(errors).toEqual([]);
});

test('P3/E2 边界、连续射击、暂停、资源压力：WebGL 原生画面',async({page},info)=>{
  test.setTimeout(100000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async()=>Number(await stage.getAttribute('data-player-x')),{timeout:20000}).toBeLessThan(2);
  await page.keyboard.up('ArrowLeft');
  let screen=Number(await stage.getAttribute('data-player-screen-x'));
  expect(screen).toBeGreaterThan(0);
  await page.screenshot({path:info.outputPath('p3-final-player-left.png'),fullPage:true});
  await page.keyboard.down('ArrowRight');
  await expect.poll(async()=>Number(await stage.getAttribute('data-player-x')),{timeout:20000}).toBeGreaterThan(34);
  await page.keyboard.up('ArrowRight');
  screen=Number(await stage.getAttribute('data-player-screen-x'));
  expect(screen).toBeLessThan(page.viewportSize()!.width);
  await page.screenshot({path:info.outputPath('p3-final-player-right.png'),fullPage:true});
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-fx-emitted')),{timeout:12000}).toBeGreaterThan(0);
  await page.keyboard.up('Space');
  await page.getByRole('button',{name:'暂停'}).click();
  await expect(stage).toHaveAttribute('data-fx-active','0');
  const datum=await stage.evaluate(el=>({
    drawCalls:+(el.dataset.drawCalls??'0'),geometries:+(el.dataset.gpuGeometries??'0'),
    textures:+(el.dataset.gpuTextures??'0'),objects:+(el.dataset.gpuAssets??'0'),
    pixelRatio:+(el.dataset.pixelRatio??'0'),fxAllocated:+(el.dataset.fxAllocated??'0'),
    foregroundVisible:+(el.dataset.foregroundVisible??'0'),
  }));
  expect(datum.drawCalls).toBeGreaterThan(0);
  expect(datum.drawCalls).toBeLessThan(72);
  expect(datum.geometries).toBeLessThan(100);
  expect(datum.textures).toBeLessThan(30);
  expect(datum.fxAllocated).toBeLessThanOrEqual(72);
  writeFileSync(info.outputPath('p3-final-boundary-metrics.json'),JSON.stringify(datum,null,2));
  expect(errors).toEqual([]);
});

test('P3/E2 40 架密集机群压力与可重复计量的软件 Chromium 帧率',async({page},info)=>{
  test.setTimeout(90000);
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    json.waves[0].formation.rows=5;
    json.waves[0].formation.startY=21;
    json.waves[0].formation.spacingY=2.2;
    await route.fulfill({response,json});
  });
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage).toHaveAttribute('data-enemy-count','40');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  const records:object[]=[];
  for(let i=0;i<7;i++){
    await page.waitForTimeout(300);
    const sample=await stage.evaluate(el=>({
      draws:Number(el.dataset.drawCalls),geometry:Number(el.dataset.gpuGeometries),
      textures:Number(el.dataset.gpuTextures),effects:Number(el.dataset.fxActive),
      enemies:Number(el.dataset.enemyCount),
    }));
    expect(sample.draws).toBeGreaterThan(0);expect(sample.draws).toBeLessThan(72);
    expect(sample.geometry).toBeLessThan(100);
    expect(sample.textures).toBeLessThan(30);
    expect(sample.effects).toBeLessThanOrEqual(72);
    records.push(sample);
  }
  const hardware=await page.evaluate(async()=>{
    const canvas=document.querySelector<HTMLCanvasElement>('[data-testid="battlefield"] canvas')!;
    const gl=canvas.getContext('webgl2');
    const debug=gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu=debug ? gl?.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : null;
    const timestamps:number[]=[];
    await new Promise<void>(resolve=>{
      const start=performance.now();
      const frame=(now:number)=>{
        timestamps.push(now);
        if(now-start>=2200)resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const duration=(timestamps.at(-1)!-timestamps[0])/1000;
    return {renderer:gpu??'unknown; no hardware guarantee',frames:timestamps.length,
      seconds:+duration.toFixed(3),fps:+((timestamps.length-1)/duration).toFixed(2)};
  });
  const report={
    platform:'Playwright Chromium on GitHub Actions Ubuntu, software rendering permitted (SwiftShader)',
    browser:page.context().browser()?.version()??'unknown',
    hardware,
    samples:records,
    nativePhoneGPU:false,
    note:'fps is measured, not promised; no claim that headless Chromium represents a real phone GPU',
  };
  writeFileSync(info.outputPath('p3-final-performance.json'),JSON.stringify(report,null,2));
  console.log('P3 final measured software GPU:',JSON.stringify(report));
  await page.screenshot({path:info.outputPath('p3-final-dense-fleet.png'),fullPage:true});
});

test.describe('P3/E2 手机视窗的真正触屏模拟（并非实体手机 GPU）',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
  test('390×844、844×390 无前景遮挡且 HUD/控制有效',async({page},info)=>{
    await page.goto('./');
    const stage=page.getByTestId('battlefield');
    await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
    await expect(stage).toHaveAttribute('data-foreground-visible','0');
    expect((await stage.locator('canvas').boundingBox())!.width).toBeGreaterThan(380);
    await page.screenshot({path:info.outputPath('p3-final-portrait.png'),fullPage:true});
    await page.getByRole('button',{name:'开始',exact:true}).tap();
    await expect(page.getByTestId('touch-fire')).toBeEnabled();
    await page.getByRole('button',{name:'暂停'}).tap();
    await expect(page.getByTestId('touch-left')).toBeDisabled();
    await page.getByRole('button',{name:'继续'}).tap();
    await page.setViewportSize({width:844,height:390});
    await expect(stage).toHaveAttribute('data-foreground-visible','0');
    expect((await stage.locator('canvas').boundingBox())!.width).toBeGreaterThan(830);
    await page.screenshot({path:info.outputPath('p3-final-landscape.png'),fullPage:true});
    await page.getByRole('button',{name:'重置'}).tap();
    await expect(stage).toHaveAttribute('data-world-width','36');
  });
});
