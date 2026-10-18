import {test,expect} from '@playwright/test';

test('P3/E1: changing only JSON swaps entire visual palette, preserves XY gameplay and same-origin assets',async({page},info)=>{
  const bad:string[]=[],remote:string[]=[];
  page.on('pageerror',e=>bad.push(e.message));
  page.on('response',res=>{if(res.status()>=400)bad.push(res.status()+' '+res.url());});
  page.on('request',request=>{
    const u=new URL(request.url());
    if(u.origin!==new URL(info.project.use.baseURL as string).origin)remote.push(request.url());
  });
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage).toHaveAttribute('data-visual-theme','nebula-blue');
  await expect(stage).toHaveAttribute('data-galaxy','loaded');
  await expect(stage).toHaveAttribute('data-galaxy-url',/\/React-SpaceInvader\/art\/backgrounds\/galaxy-reactmono-veil\.webp$/);
  const original=await stage.evaluate(el=>({geometry:el.dataset.gpuGeometries,texture:el.dataset.gpuTextures,world:el.dataset.worldWidth}));
  await page.screenshot({path:info.outputPath('p3-e1-default-blue.png'),fullPage:true});
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(stage).toHaveAttribute('data-visual-theme','violet-drift');
  await expect(stage).toHaveAttribute('data-galaxy','loaded');
  await expect(stage).toHaveAttribute('data-total-waves','2');
  await expect(stage).toHaveAttribute('data-world-width',original.world!);
  expect(Number(await stage.getAttribute('data-gpu-geometries'))).toBeLessThan(100);
  expect(Number(await stage.getAttribute('data-gpu-textures'))).toBeLessThan(30);
  await page.screenshot({path:info.outputPath('p3-e1-violet-crossfire.png'),fullPage:true});
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(stage).toHaveAttribute('data-game-phase','running');
  await page.getByRole('button',{name:'暂停'}).click();
  await page.getByRole('button',{name:'重置'}).click();
  await page.getByTestId('level-select').selectOption('first-contact');
  await expect(stage).toHaveAttribute('data-visual-theme','nebula-blue');
  await expect(stage).toHaveAttribute('data-total-waves','1');
  expect(remote).toEqual([]);expect(bad).toEqual([]);
});

test('P3/E1: invalid visualTheme URL is diagnosed and safely defaults without blocking game',async({page})=>{
  const remote:string[]=[];
  page.on('request',request=>{if(/malicious\.invalid/.test(request.url()))remote.push(request.url());});
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch(),data=await response.json();
    data.visualTheme='https://malicious.invalid/cdn/background.png';
    await route.fulfill({response,json:data});
  });
  await page.goto('./');
  const stage=page.getByTestId('battlefield');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await expect(stage).toHaveAttribute('data-visual-theme','nebula-blue');
  await expect(stage).toHaveAttribute('data-visual-theme-warning',/回退/);
  await expect(stage).toHaveAttribute('data-galaxy','loaded');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(stage).toHaveAttribute('data-game-phase','running');
  expect(remote).toEqual([]);
});
