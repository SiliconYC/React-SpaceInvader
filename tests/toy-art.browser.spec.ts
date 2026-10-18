import {test,expect} from '@playwright/test';

/** #101: recorded REAL WebGL views, never conceptual renders or mocked screenshots. */
test('101 toy fleet: four real 3D silhouettes, painted sky, and safe multi-viewport composition',async({page},info)=>{
  test.setTimeout(120000);
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const v of [
    {width:1920,height:1080},{width:844,height:390},{width:390,height:844},
  ]){
    await page.setViewportSize(v);
    await page.goto('./');
    const stage=page.getByTestId('battlefield');
    await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
    await expect(stage).toHaveAttribute('data-galaxy','loaded');
    await expect(stage).toHaveAttribute('data-galaxy-url',/\/toy-orbit\.svg$/);
    await expect(stage).toHaveAttribute('data-enemy-count','24');
    await page.screenshot({path:info.outputPath('101-scout-'+v.width+'x'+v.height+'.png'),fullPage:true});
    const draws=Number(await stage.getAttribute('data-draw-calls'));
    expect(draws).toBeLessThan(72);
    if(v.width===1920){
      await page.getByTestId('level-select').selectOption('crossfire');
      await expect(stage).toHaveAttribute('data-enemy-kinds','raider');
      await page.screenshot({path:info.outputPath('101-raider-1920.png'),fullPage:true});
    }
  }
  await page.setViewportSize({width:1440,height:900});
  for(const kind of ['player','scout','raider','guardian']){
    await page.goto('./?shipPreview='+kind+'&shipAngle=tilt');
    await expect(page.getByTestId('battlefield')).toHaveAttribute('data-ship-preview',kind);
    await page.screenshot({path:info.outputPath('101-'+kind+'-3d.png'),fullPage:true});
  }
  // An honest background-only A/B switch is preserved, not a fake before screenshot.
  await page.goto('./?galaxy=veil');
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-galaxy-variant','veil');
  await page.screenshot({path:info.outputPath('101-legacy-p4-sky-reference.png'),fullPage:true});
  expect(errors).toEqual([]);
});
