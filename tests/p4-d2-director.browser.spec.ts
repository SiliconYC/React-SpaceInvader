import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test.use({video:'on'});

test('P4/D2 开场、暂停、重置、横竖屏和减少动态效果：真实 WebGL 连续帧',async({page},info)=>{
  test.setTimeout(150_000);
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(stage).toHaveAttribute('data-camera-director','opening');
  await page.screenshot({path:info.outputPath('p4-d2-opening-frame-1.png'),fullPage:true});
  await page.getByRole('button',{name:'暂停'}).click();
  await expect(stage).toHaveAttribute('data-game-phase','paused');
  const frozen=await stage.getAttribute('data-camera-director-progress');
  await page.waitForTimeout(260);
  await expect(stage).toHaveAttribute('data-camera-director-progress',frozen??'');
  await page.screenshot({path:info.outputPath('p4-d2-opening-paused.png'),fullPage:true});
  await page.getByRole('button',{name:'继续'}).click();
  await expect(stage).toHaveAttribute('data-camera-director','idle',{timeout:6000});
  await expect(stage).toHaveAttribute('data-camera-director-zoom','1.00000');
  await page.getByRole('button',{name:'重置'}).click();
  await expect(stage).toHaveAttribute('data-camera-director','idle');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.getByRole('button',{name:'重置'}).click();
  await expect(stage).toHaveAttribute('data-camera-director','idle');
  for(const [width,height] of [[844,390],[390,844]] as const){
    await page.setViewportSize({width,height});
    await page.getByRole('button',{name:'开始',exact:true}).click();
    await expect(stage).toHaveAttribute('data-camera-director','opening');
    await page.screenshot({path:info.outputPath(`p4-d2-opening-${width}x${height}.png`),fullPage:true});
    await expect(stage).toHaveAttribute('data-camera-director','idle',{timeout:6000});
    await expect(stage).toHaveAttribute('data-camera-director-zoom','1.00000');
    const canvas=await stage.locator('canvas').boundingBox();
    expect(canvas!.width).toBeGreaterThanOrEqual(width-2);
    expect(canvas!.height).toBeGreaterThanOrEqual(height-2);
    await page.getByRole('button',{name:'重置'}).click();
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(stage).toHaveAttribute('data-camera-director','idle');
  await expect(stage).toHaveAttribute('data-camera-director-zoom','1.00000');
  await page.screenshot({path:info.outputPath('p4-d2-reduced-motion.png'),fullPage:true});
});

test('P4/D2 两波连贯实战、换波运镜暂停/恢复、胜利镜头复位',async({page},info)=>{
  test.setTimeout(150_000);
  await page.route('**/levels/crossfire.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    for(let i=0;i<json.waves.length;i++){
      const w=json.waves[i];
      Object.assign(w.formation,{rows:1,columns:1,startX:18,startY:10});
      w.movement.horizontalSpeed=0;w.attack.shotsPerMinute=0;
      if(i===1)w.behavior.armorHits=1;
    }
    json.waves[1].spawnAtSeconds=2;
    await route.fulfill({response,json});
  });
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(stage).toHaveAttribute('data-enemy-count','1');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  // Pause via the real UI as soon as a moving wave-camera frame is rendered.
  // A slow software GPU can finish this short cue between two protocol polls.
  await stage.evaluate(el=>{
    const observer=new MutationObserver(()=>{
      const d=(el as HTMLElement).dataset;
      const progress=Number(d.cameraDirectorProgress),zoom=Number(d.cameraDirectorZoom);
      if(d.cameraDirector!=='wave'||progress<=0||progress>=1||zoom<=1)return;
      const pause=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='暂停');
      if(pause){observer.disconnect();pause.click();}
    });
    observer.observe(el,{attributes:true,attributeFilter:['data-camera-director-progress','data-camera-director-zoom']});
  });
  await page.keyboard.down('Space');
  await expect(stage).toHaveAttribute('data-waiting-for-wave','true',{timeout:10000});
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-wave','2',{timeout:10000});
  await expect(stage).toHaveAttribute('data-camera-director','wave');
  const movingZoom=Number(await stage.getAttribute('data-camera-director-zoom'));
  expect(movingZoom).toBeGreaterThan(1);
  const movingProgress=Number(await stage.getAttribute('data-camera-director-progress'));
  expect(movingProgress).toBeGreaterThan(0);
  expect(movingProgress).toBeLessThan(1);
  await expect(stage).toHaveAttribute('data-game-phase','paused');
  await page.screenshot({path:info.outputPath('p4-d2-wave-frame-1.png'),fullPage:true});
  const held=await stage.getAttribute('data-camera-director-progress');
  await page.waitForTimeout(240);
  await expect(stage).toHaveAttribute('data-camera-director-progress',held??'');
  await page.screenshot({path:info.outputPath('p4-d2-wave-paused.png'),fullPage:true});
  await page.getByRole('button',{name:'继续'}).click();
  await expect(stage).toHaveAttribute('data-camera-director','idle',{timeout:7000});
  await expect(stage).toHaveAttribute('data-camera-director-zoom','1.00000');
  await page.keyboard.down('Space');
  await expect(stage).toHaveAttribute('data-game-phase','won',{timeout:10000});
  await page.keyboard.up('Space');
  await expect(stage).toHaveAttribute('data-camera-director','victory');
  await page.screenshot({path:info.outputPath('p4-d2-victory-frame-1.png'),fullPage:true});
  await expect.poll(async()=>Number(await stage.getAttribute('data-camera-director-progress')),
    {timeout:7000}).toBe(1);
  const settledZoom=Number(await stage.getAttribute('data-camera-director-zoom'));
  expect(settledZoom).toBeGreaterThan(1);
  await page.screenshot({path:info.outputPath('p4-d2-victory-frame-2.png'),fullPage:true});
  const record=await stage.evaluate(el=>({
    phase:el.dataset.gamePhase,cue:el.dataset.cameraDirector,
    zoom:el.dataset.cameraDirectorZoom,worldWidth:el.dataset.worldWidth,
    draws:el.dataset.drawCalls,playerX:el.dataset.playerX,
  }));
  expect(record.worldWidth).toBe('36');
  writeFileSync(info.outputPath('p4-d2-camera-data.json'),JSON.stringify(record,null,2));
  await page.getByRole('button',{name:'重置'}).click();
  await expect(stage).toHaveAttribute('data-camera-director','idle');
  await expect(stage).toHaveAttribute('data-camera-director-zoom','1.00000');
});

test('P4/D2 防线失守进入独立失败镜头，重置后完全清零',async({page},info)=>{
  test.setTimeout(120_000);
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:12});
    Object.assign(json.waves[0].movement,{horizontalSpeed:40,descentPerTurn:25,moveEveryTicks:1});
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(stage).toHaveAttribute('data-game-phase','lost',{timeout:10000});
  await expect(stage).toHaveAttribute('data-camera-director','defeat');
  await page.screenshot({path:info.outputPath('p4-d2-defeat-frame-1.png'),fullPage:true});
  await expect.poll(async()=>Number(await stage.getAttribute('data-camera-director-progress')),
    {timeout:7000}).toBe(1);
  expect(Number(await stage.getAttribute('data-camera-director-zoom'))).toBeLessThan(1);
  await page.screenshot({path:info.outputPath('p4-d2-defeat-frame-2.png'),fullPage:true});
  await page.getByRole('button',{name:'重置'}).click();
  await expect(stage).toHaveAttribute('data-camera-director','idle');
  await expect(stage).toHaveAttribute('data-camera-director-zoom','1.00000');
});
