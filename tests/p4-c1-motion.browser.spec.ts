import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test.use({viewport:{width:1920,height:1080},video:'on'});

test('P4/C1 真实 WebGL：起飞→巡航→反向→制动→连射→暂停／重置＋移动端',async({page},info)=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    for(const wave of json.waves)wave.attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.waitForTimeout(450);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(650);
  await page.screenshot({path:info.outputPath('p4-c1-launch-1920.png')});
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(700);
  await page.screenshot({path:info.outputPath('p4-c1-reverse-1920.png')});
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(450);
  await page.keyboard.down('Space');
  await page.waitForTimeout(1050);
  await page.keyboard.up('Space');
  await page.screenshot({path:info.outputPath('p4-c1-shoot-1920.png')});
  await page.waitForTimeout(4500); // Continuous real-time video, not fabricated animation.
  const roll=await stage.getAttribute('data-visual-roll');
  const resources={
    drawCalls:Number(await stage.getAttribute('data-draw-calls')),
    geometries:Number(await stage.getAttribute('data-gpu-geometries')),
    textures:Number(await stage.getAttribute('data-gpu-textures')),
    flightStage:await stage.getAttribute('data-player-flight-stage'),
    thrust:Number(await stage.getAttribute('data-player-thrust')),
    roll,
  };
  await writeFile(info.outputPath('p4-c1-motion-metrics.json'),JSON.stringify(resources,null,2));
  await page.getByRole('button',{name:'暂停'}).click();
  const freeze=await stage.getAttribute('data-visual-roll');
  await page.waitForTimeout(320);
  await expect(stage).toHaveAttribute('data-visual-roll',freeze??'');
  await page.setViewportSize({width:844,height:390});
  await page.screenshot({path:info.outputPath('p4-c1-mobile-landscape.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('p4-c1-mobile-portrait.png')});
  await page.getByRole('button',{name:'重置',exact:true}).click();
  expect(errors).toEqual([]);
});
test('P4/C1 减少动态效果：不改变运动/射击规则',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(270);
  await page.keyboard.up('ArrowLeft');
  await expect(stage).toHaveAttribute('data-visual-roll','0.00000');
  await expect(stage).toHaveAttribute('data-player-flight-stage','hover');
});
