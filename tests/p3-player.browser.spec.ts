import {test,expect} from '@playwright/test';

test('P3/B1: 正常游戏的玩家模型与单独三轴近景，真实 WebGL 截屏',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage).toHaveAttribute('data-ship-preview','off');
  await expect(stage).toHaveAttribute('data-player-x','18.0000');
  await page.screenshot({path:info.outputPath('p3-b1-player-gameplay.png'),fullPage:true});
  await page.goto('./?shipPreview=player');
  await expect(stage).toHaveAttribute('data-ship-preview','player');
  await page.screenshot({path:info.outputPath('p3-b1-player-close-front.png'),fullPage:true});
  await page.goto('./?shipPreview=player&shipAngle=tilt');
  await expect(stage).toHaveAttribute('data-ship-preview','player');
  await page.screenshot({path:info.outputPath('p3-b1-player-close-tilt.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await expect(stage).toHaveAttribute('data-world-width','36');
  await page.screenshot({path:info.outputPath('p3-b1-player-portrait.png'),fullPage:true});
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('ArrowLeft');
  await expect.poll(async()=>Number(await stage.getAttribute('data-player-x'))).toBeLessThan(17);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-bullet-count'))).toBeGreaterThan(0);
  await page.keyboard.up('Space');
  expect(errors).toEqual([]);
});
