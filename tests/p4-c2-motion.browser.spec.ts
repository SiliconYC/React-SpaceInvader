import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test.use({video:'on'});
test('P4/C2：三种敌机原生 WebGL 动态编队、事件姿态与批次不膨胀',async({page},info)=>{
  test.setTimeout(90000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  let kind:'scout'|'raider'|'guardian'='scout';
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    json.waves[0].formation.type=kind;
    json.waves[0].attack.shotsPerMinute=180;
    json.waves[0].movement.horizontalSpeed=6;
    json.waves[0].behavior.armorHits=kind==='guardian'?3:1;
    await route.fulfill({response,json});
  });
  const stage=page.getByTestId('battlefield');
  const metrics:Record<string,unknown>[]=[];
  for(kind of ['scout','raider','guardian'] as const){
    await page.setViewportSize({width:1920,height:1080});
    await page.goto('./');
    await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
    await expect(stage).toHaveAttribute('data-enemy-kinds',kind);
    await page.getByRole('button',{name:'开始',exact:true}).click();
    await page.waitForTimeout(1200);
    const calls=Number(await stage.getAttribute('data-draw-calls'));
    expect(calls).toBeLessThan(65);
    await page.screenshot({path:info.outputPath('p4-c2-'+kind+'-flight.png')});
    await page.getByRole('button',{name:'暂停'}).click();
    const current=await stage.getAttribute('data-enemy-visual-roll');
    await page.waitForTimeout(210);
    await expect(stage).toHaveAttribute('data-enemy-visual-roll',current??'');
    metrics.push({kind,calls,enemyCount:Number(await stage.getAttribute('data-enemy-count')),
      geometries:Number(await stage.getAttribute('data-gpu-geometries')),
      textures:Number(await stage.getAttribute('data-gpu-textures')),
      attackCues:Number(await stage.getAttribute('data-enemy-attack-cues'))});
  }
  await page.setViewportSize({width:844,height:390});
  await page.screenshot({path:info.outputPath('p4-c2-landscape.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath('p4-c2-portrait.png')});
  await writeFile(info.outputPath('p4-c2-batches.json'),
    JSON.stringify({browser:'Chromium with software GPU; not a hardware mobile test',metrics},null,2));
  expect(errors).toEqual([]);
});
