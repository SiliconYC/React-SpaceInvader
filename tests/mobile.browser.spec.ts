import { test, expect } from '@playwright/test';

test.describe('模拟真实移动设备触控',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3});
  test('触屏从开始→长按射击→胜利→重玩→暂停/继续，画布不被裁切',async({page},info)=>{
    await page.route('**/levels/first-contact.json',async route=>{
      const response=await route.fetch(),json=await response.json();
      Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:10});
      json.waves[0].movement.horizontalSpeed=0;
      json.waves[0].attack.shotsPerMinute=0;
      await route.fulfill({response,json});
    });
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('./');
    await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
    const stage=page.getByTestId('battlefield');
    await expect(page.getByTestId('touch-left')).toBeVisible();
    await expect(page.getByTestId('touch-fire')).toBeVisible();
    await expect(stage).toHaveAttribute('data-pixel-ratio','1.50');
    const box=await stage.locator('canvas').boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(380);
    expect(box!.height).toBeGreaterThanOrEqual(830);
    await page.screenshot({path:info.outputPath('touch-portrait.png'),fullPage:true});
    await page.getByRole('button',{name:'开始',exact:true}).tap();
    const fire=await page.getByTestId('touch-fire').boundingBox();
    const client=await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:10,x:fire!.x+fire!.width/2,y:fire!.y+fire!.height/2}]});
    await expect.poll(async()=>Number(await stage.getAttribute('data-bullet-count')),{timeout:7000}).toBeGreaterThan(0);
    await expect(stage).toHaveAttribute('data-game-phase','won',{timeout:8000});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.getByTestId('game-result')).toContainText('胜利');
    await page.getByRole('button',{name:'重新开始'}).tap();
    await expect(stage).toHaveAttribute('data-game-phase','running');
    await page.getByRole('button',{name:'暂停'}).tap();
    await expect(page.getByTestId('pause-message')).toBeVisible();
    await page.getByRole('button',{name:'继续'}).tap();
    await expect(page.getByTestId('pause-message')).toHaveCount(0);
    await page.getByRole('button',{name:'重置'}).tap();
    await page.getByTestId('level-select').selectOption('crossfire');
    await expect(stage).toHaveAttribute('data-total-waves','2');
    await page.setViewportSize({width:844,height:390});
    await expect(stage.locator('canvas')).toBeVisible();
    await page.screenshot({path:info.outputPath('touch-landscape.png'),fullPage:true});
    expect(errors).toEqual([]);
  });
  test('触屏多指移动+持续射击、单指释放、失焦与按钮禁用防粘键',async({page})=>{
    await page.goto('./');
    await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
    await page.getByRole('button',{name:'开始',exact:true}).tap();
    const stage=page.getByTestId('battlefield');
    const left=await page.getByTestId('touch-left').boundingBox();
    const fire=await page.getByTestId('touch-fire').boundingBox();
    const pos=(b:NonNullable<typeof left>,id:number)=>({id,x:b.x+b.width/2,y:b.y+b.height/2});
    const leftPoint=pos(left!,1),firePoint=pos(fire!,2);
    const client=await page.context().newCDPSession(page);
    const startX=Number(await stage.getAttribute('data-player-x'));
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[leftPoint]});
    await expect.poll(async()=>Number(await stage.getAttribute('data-player-x'))).toBeLessThan(startX-.6);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[leftPoint,firePoint]});
    await expect.poll(async()=>Number(await stage.getAttribute('data-touch-held'))).toBe(2);
    await expect.poll(async()=>Number(await stage.getAttribute('data-bullet-count')),{timeout:7000}).toBeGreaterThan(0);
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[firePoint]});
    await expect(stage).toHaveAttribute('data-touch-held','1');
    const stopped=Number(await stage.getAttribute('data-player-x'));
    await page.waitForTimeout(200);
    expect(Math.abs(Number(await stage.getAttribute('data-player-x'))-stopped)).toBeLessThan(.5);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await expect(stage).toHaveAttribute('data-touch-held','0');
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.getByRole('button',{name:'暂停'}).tap();
    await expect(page.getByTestId('touch-left')).toBeDisabled();
  });
});

test('重复切关与重置，低开销 WebGL 对象有界；记录实际软件 Chromium 帧率而不杜撰 GPU 结果',async({page},info)=>{
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const stage=page.getByTestId('battlefield');
  const records:unknown[]=[];
  for(let i=0;i<6;i++){
    await page.getByTestId('level-select').selectOption(i%2?'crossfire':'first-contact');
    await expect(stage).toHaveAttribute('data-total-waves',i%2?'2':'1');
    await page.getByRole('button',{name:'开始',exact:true}).click();
    await page.keyboard.down('Space');
    await page.waitForTimeout(160);
    await page.keyboard.up('Space');
    const datum=await stage.evaluate(el=>({
      drawCalls:Number(el.dataset.drawCalls),
      geometries:Number(el.dataset.gpuGeometries),
      textures:Number(el.dataset.gpuTextures),
      pixRatio:Number(el.dataset.pixelRatio),
      enemies:Number(el.dataset.enemyCount),
      effects:Number(el.dataset.fxActive),
    }));
    expect(datum.drawCalls).toBeGreaterThan(0);
    expect(datum.drawCalls).toBeLessThan(180);
    expect(datum.geometries).toBeLessThan(100);
    expect(datum.textures).toBeLessThan(30);
    expect(datum.effects).toBeLessThanOrEqual(72);
    records.push(datum);
    await page.getByRole('button',{name:'重置'}).click();
    await expect(stage.locator('canvas')).toHaveCount(1);
  }
  const fps=await page.evaluate(async()=>{
    const marks:number[]=[];
    await new Promise<void>(resolve=>{
      const begin=performance.now();
      const sample=(time:number)=>{
        marks.push(time);
        if(time-begin>1300)resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const seconds=(marks.at(-1)!-marks[0])/1000;
    return {frames:marks.length,seconds,fps:+((marks.length-1)/seconds).toFixed(1)};
  });
  console.log('Chromium SwiftShader measured baseline:',JSON.stringify({runs:records,fps}));
  expect(fps.fps).toBeGreaterThan(1); // no fabricated hardware/FPS guarantee
  await info.attach('mobile-gpu-performance.json',{body:JSON.stringify({runs:records,fps},null,2),contentType:'application/json'});
  await expect(stage).toHaveAttribute('data-world-width','36');
});

test('WebGL 显示上下文真实丢失后恢复，保持单画布、规则时钟不追赶',async({page})=>{
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  const stage=page.getByTestId('battlefield');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  const available=await page.evaluate(()=>{
    const canvas=document.querySelector<HTMLCanvasElement>('[data-testid="battlefield"] canvas');
    const ctx=canvas?.getContext('webgl2');
    const ext=ctx?.getExtension('WEBGL_lose_context');
    (window as unknown as {__loss:typeof ext}).__loss=ext;
    if(!ext)return false;
    ext.loseContext();return true;
  });
  test.skip(!available,'当前 Chromium 不支持 WEBGL_lose_context 扩展');
  await expect(stage).toHaveAttribute('data-webgl-context','lost',{timeout:5000});
  await expect(page.getByTestId('webgl-status')).toContainText('等待恢复');
  await page.waitForTimeout(300);
  await page.evaluate(()=>(window as unknown as {__loss:{restoreContext():void}}).__loss.restoreContext());
  await expect(stage).toHaveAttribute('data-webgl-context','ready',{timeout:12000});
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage.locator('canvas')).toHaveCount(1);
  await expect(stage).toHaveAttribute('data-game-phase','running');
});
