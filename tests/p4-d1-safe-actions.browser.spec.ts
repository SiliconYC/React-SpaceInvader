import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test.use({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2});

test('P4/D1: 真触控横竖屏暂停/重置不遮挡玩家战机与虚拟射击控制',async({page},info)=>{
  test.setTimeout(100_000);
  const records:unknown[]=[];
  for(const [width,height] of [[844,390],[390,844]] as const){
    await page.setViewportSize({width,height});
    await page.goto('./');
    const stage=page.getByTestId('battlefield');
    await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
    await page.getByRole('button',{name:'开始',exact:true}).tap();
    const actions=(await page.locator('.play-actions').boundingBox())!;
    const touch=(await page.getByTestId('touch-fire').boundingBox())!;
    const player=await stage.evaluate(el=>({
      x:Number(el.dataset.playerScreenX),y:Number(el.dataset.playerScreenY),
    }));
    const overlaps=(r:{x:number,y:number,width:number,height:number},x:number,y:number,pad=24)=>
      x>=r.x-pad&&x<=r.x+r.width+pad&&y>=r.y-pad&&y<=r.y+r.height+pad;
    expect(overlaps(actions,player.x,player.y),'操作栏遮挡玩家飞船').toBe(false);
    expect(actions.y+actions.height).toBeLessThan(touch.y-8);
    expect(actions.x).toBeGreaterThan(width*.66);
    records.push({width,height,actions,touch,player});
    await page.screenshot({path:info.outputPath(`p4-d1-safe-actions-${width}x${height}.png`),fullPage:true});
    await page.getByRole('button',{name:'暂停'}).tap();
    await expect(page.getByTestId('pause-message')).toBeVisible();
    await page.getByRole('button',{name:'继续'}).tap();
    await page.getByRole('button',{name:'重置'}).tap();
  }
  writeFileSync(info.outputPath('p4-d1-safe-actions.json'),JSON.stringify(records,null,2));
});
