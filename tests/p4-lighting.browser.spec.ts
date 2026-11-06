import { test,expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('P4/A4 同一状态两个灯光方案、四种屏幕完整正常战斗 WebGL',async({page},info)=>{
  test.setTimeout(110000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const metrics:Record<string,unknown>[]=[];
  const cdp=await page.context().newCDPSession(page);
  // The game fills the viewport. Capture the real completed WebGL surface
  // without Playwright waiting for extra animation frames on a software GPU.
  const capture=async(name:string)=>{
    // Observe a new application render before reading the compositor surface.
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
    const {data}=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
    writeFileSync(info.outputPath(name),Buffer.from(data,'base64'));
  };
  for(const {width,height} of [
    {width:1920,height:1080},{width:1440,height:900},
    {width:844,height:390},{width:390,height:844},
  ]){
    await page.setViewportSize({width,height});
    for(const variant of ['studio','soft'] as const){
      await page.goto('./?light='+variant);
      const stage=page.getByTestId('battlefield');
      await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
      await expect(stage).toHaveAttribute('data-p4-lighting',variant);
      await expect(stage).toHaveAttribute('data-enemy-count','24');
      await expect(stage).toHaveAttribute('data-studio-environment','loaded');
      await expect(stage).toHaveAttribute('data-galaxy','loaded');
      await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
      const m=await stage.evaluate(el=>({
        draws:+(el.dataset.drawCalls??'0'),geometries:+(el.dataset.gpuGeometries??'0'),
        textures:+(el.dataset.gpuTextures??'0'),assets:+(el.dataset.gpuAssets??'0'),
        pixelRatio:+(el.dataset.pixelRatio??'0'),galaxy:el.dataset.galaxy,
      }));
      expect(m.draws).toBeGreaterThan(0);
      expect(m.draws).toBeLessThan(72);
      expect(m.geometries).toBeLessThan(100);
      metrics.push({width,height,variant,...m});
      await capture(`p4-a4-${width}x${height}-${variant}.png`);
    }
  }
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-studio-environment','loaded');
  await expect(stage).toHaveAttribute('data-galaxy','loaded');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('ArrowRight');
  for(let i=0;i<5;i++){
    await page.waitForTimeout(140);
    await capture('p4-a4-flight-frame-'+i+'.png');
  }
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await page.keyboard.up('Space');
  await capture('p4-a4-combat-live.png');
  const fps=await page.evaluate(async()=>{
    const times:number[]=[];
    await new Promise<void>(resolve=>{
      const start=performance.now();
      const sample=(now:number)=>{
        times.push(now);
        if(now-start>1200)resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return +(1000*(times.length-1)/(times.at(-1)!-times[0])).toFixed(1);
  });
  writeFileSync(info.outputPath('p4-a4-render-metrics.json'),JSON.stringify({
    platform:'GitHub Actions Chromium; WebGL may use SwiftShader; NOT a physical phone benchmark',
    fps,measurements:metrics,
  },null,2));
  console.log('P4 A4 software-WebGL metrics:',JSON.stringify({fps,measurements:metrics}));
  expect(errors).toEqual([]);
});
