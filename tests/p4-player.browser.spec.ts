import { test,expect } from '@playwright/test';

test('P4/A2 玩家原生 WebGL 近景/倾斜/竖屏和连续移动证据',async({page},info)=>{
  test.setTimeout(85000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.screenshot({path:info.outputPath('p4-a2-player-normal-1920.png'),fullPage:true});
  for(const angle of ['front','tilt'] as const){
    await page.goto('./?shipPreview=player'+(angle==='tilt'?'&shipAngle=tilt':''));
    await expect(stage).toHaveAttribute('data-ship-preview','player');
    await page.screenshot({path:info.outputPath('p4-a2-player-'+angle+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await expect(stage).toHaveAttribute('data-enemy-count','24');
  await page.screenshot({path:info.outputPath('p4-a2-player-portrait.png'),fullPage:true});
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('ArrowLeft');
  for(let i=0;i<4;i++){
    await page.waitForTimeout(130);
    await page.screenshot({path:info.outputPath('p4-a2-player-motion-'+i+'.png'),fullPage:true});
  }
  await page.keyboard.up('ArrowLeft');
  expect(errors).toEqual([]);
});
