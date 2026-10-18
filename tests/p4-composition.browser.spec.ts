import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

/** Same seeded wave, same input, two actual Three.js camera layouts; no image composites. */
test('P4/A1 stage 与 breathing：桌面/手机真 WebGL 构图与屏幕投影',async({page},info)=>{
  test.setTimeout(90000);
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  const cases=[
    {width:1920,height:1080,mobile:false},
    {width:1440,height:900,mobile:false},
    {width:844,height:390,mobile:true},
    {width:390,height:844,mobile:true},
  ];
  const metrics:Record<string,unknown>[]=[];
  for(const view of cases){
    await page.setViewportSize({width:view.width,height:view.height});
    for(const variant of ['stage','breathing'] as const){
      await page.goto('./?composition='+variant);
      const battle=page.getByTestId('battlefield');
      await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
      await expect(battle).toHaveAttribute('data-composition',variant);
      await expect(battle).toHaveAttribute('data-enemy-count','24');
      if(view.width===1920&&variant==='stage'){
        await expect(battle).toHaveAttribute('data-galaxy','loaded');
        await expect(battle).toHaveAttribute('data-galaxy-url',
          '/React-SpaceInvader/art/backgrounds/galaxy-reactmono-veil.webp');
        await expect(battle).toHaveAttribute('data-galaxy-variant','theme');
      }
      const canvas=await battle.locator('canvas').boundingBox();
      expect(canvas?.width).toBeGreaterThanOrEqual(view.width-2);
      expect(canvas?.height).toBeGreaterThanOrEqual(view.height-2);
      const datum=await battle.evaluate(el=>({
        spanX:+(el.dataset.cameraSpanX??'0'),spanY:+(el.dataset.cameraSpanY??'0'),
        centerY:+(el.dataset.cameraCenterY??'0'),playerX:+(el.dataset.playerScreenX??'0'),
        playerY:+(el.dataset.playerScreenY??'0'),draws:+(el.dataset.drawCalls??'0'),
        galaxy:el.dataset.galaxy,foreground:el.dataset.foregroundVisible,
      }));
      expect(datum.playerX).toBeGreaterThan(0);
      expect(datum.playerX).toBeLessThan(view.width);
      expect(datum.playerY).toBeGreaterThan(0);
      expect(datum.playerY).toBeLessThan(view.height);
      expect(datum.draws).toBeGreaterThan(0);
      metrics.push({...view,variant,...datum});
      await page.screenshot({path:info.outputPath(`p4-a1-${view.width}x${view.height}-${variant}.png`),fullPage:true});
    }
  }
  for(let i=0;i<metrics.length;i+=2){
    const a=metrics[i] as {spanY:number},b=metrics[i+1] as {spanY:number};
    expect(b.spanY).toBeGreaterThan(a.spanY);
  }
  writeFileSync(info.outputPath('p4-a1-compositions.json'),JSON.stringify(metrics,null,2));
  expect(errors).toEqual([]);
});
