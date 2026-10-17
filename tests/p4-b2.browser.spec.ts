import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {statSync} from 'node:fs';

test('P4/B2 真贴图 + 真球环：同条件旧版/两套新银河对照',async({page},info)=>{
  test.setTimeout(110000);
  const stage=page.getByTestId('battlefield');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const data:Record<string,unknown>[]=[];
  for(const size of [{width:1920,height:1080},{width:390,height:844}]){
    await page.setViewportSize(size);
    for(const variant of ['legacy','veil','arc'] as const){
      const file=variant==='legacy'?'galaxy-v2.webp':'galaxy-p4-'+variant+'.webp';
      const response=page.waitForResponse(r=>r.url().endsWith('/art/backgrounds/'+file));
      await page.goto('./?galaxy='+variant);
      expect((await response).ok()).toBe(true);
      await expect(stage).toHaveAttribute('data-galaxy','loaded');
      await expect(stage).toHaveAttribute('data-galaxy-variant',variant);
      await expect(stage).toHaveAttribute('data-planet-meshes','3');
      const stats=await stage.evaluate(el=>({
        draws:Number(el.dataset.drawCalls),geometries:Number(el.dataset.gpuGeometries),
        textures:Number(el.dataset.gpuTextures),assets:Number(el.dataset.gpuAssets),
        planetMeshes:el.dataset.planetMeshes,
      }));
      expect(stats.draws).toBeGreaterThan(0);
      await page.screenshot({path:info.outputPath(`p4-b2-${variant}-${size.width}x${size.height}.png`),fullPage:true});
      data.push({...size,variant,...stats});
    }
  }
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./?galaxy=veil&planetInspect=side');
  await expect(stage).toHaveAttribute('data-planet-meshes','3');
  await page.screenshot({path:info.outputPath('p4-b2-planet-tilt.png'),fullPage:true});
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await stage.getAttribute('data-bullet-count'))).toBeGreaterThan(0);
  await page.keyboard.up('Space');
  await page.screenshot({path:info.outputPath('p4-b2-live-bullets.png'),fullPage:true});
  for(const variant of ['arc','veil']){
    const path='public/art/backgrounds/galaxy-p4-'+variant+'-source.png';
    expect(statSync(path).size).toBeGreaterThan(100000);
    expect(statSync(path.replace('-source.png','.webp')).size).toBeGreaterThan(8000);
  }
  writeFileSync(info.outputPath('p4-b2-metrics.json'),
    JSON.stringify({source:'Chromium software/desktop WebGL, not physical mobile',data},null,2));
  expect(errors).toEqual([]);
});
