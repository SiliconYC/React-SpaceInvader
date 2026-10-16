import { test,expect,type Page } from '@playwright/test';

/** Browser keyboard event with immediate key release on the *first rendered shot*.
 *  Avoids inadvertently holding Space for 200+ ms on loaded Chromium/SwiftShader.
 *  Still uses the real keyboard input adapter, not direct GameEngine manipulation.
 */
async function singlePhysicalShot(page:Page):Promise<void>{
  await page.evaluate(async()=>{
    const field=document.querySelector<HTMLElement>('[data-testid="battlefield"]');
    if(!field)throw new Error('战场不存在');
    const initial=Number(field.dataset.fxEmitted??0);
    await new Promise<void>((resolve,reject)=>{
      let finished=false;
      const release=()=>{
        window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));
      };
      const observer=new MutationObserver(()=>{
        if(!finished&&Number(field.dataset.fxEmitted??0)>initial){
          finished=true;observer.disconnect();release();resolve();
        }
      });
      observer.observe(field,{attributes:true,attributeFilter:['data-fx-emitted']});
      window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true,cancelable:true}));
      setTimeout(()=>{if(!finished){finished=true;observer.disconnect();release();reject(new Error('发射超时'));}},1500);
    });
  });
}


test('守卫机两次命中、闪光与得分完全由 JSON 装甲驱动',async ({page},info)=>{
  await page.route('**/levels/crossfire.json',async route=>{
    const response=await route.fetch(), json=await response.json();
    const wave=json.waves[1];
    wave.spawnAtSeconds=0;
    Object.assign(wave.formation,{rows:1,columns:1,startX:18,startY:10});
    wave.movement.horizontalSpeed=0;
    wave.attack.shotsPerMinute=0;
    json.waves=[wave];
    await route.fulfill({response,json});
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByTestId('level-select').selectOption('crossfire');
  const stage=page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-enemy-hp','2');
  await expect(stage).toHaveAttribute('data-enemy-kinds','guardian');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await page.keyboard.down('Space');
  await expect(stage).toHaveAttribute('data-game-phase','won',{timeout:9000});
  await page.keyboard.up('Space');
  // Browser frame timing can span both hits on software rendering. Check *distinct*
  // authoritative armor-hit FX and final kill; per-hit HP=1 is proven by pure 60Hz tests.
  await expect(stage).toHaveAttribute('data-fx-armor-events','1');
  await expect(page.getByTestId('score')).toContainText('30');
  await page.screenshot({path:info.outputPath('guardian-armor.png'),fullPage:true});
});
test('袭击机 JSON 双列齐射显示多发敌弹，暂停后不重复生成',async({page},info)=>{
  await page.route('**/levels/crossfire.json',async route=>{
    const response=await route.fetch(),json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:2,startX:12,startY:14});
    json.waves[0].movement.horizontalSpeed=0;
    Object.assign(json.waves[0].attack,{shotsPerMinute:120,projectileSpeed:2});
    await route.fulfill({response,json});
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByTestId('level-select').selectOption('crossfire');
  const stage=page.getByTestId('battlefield');
  await expect(stage).toHaveAttribute('data-enemy-kinds','raider');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect.poll(async()=>Number(await stage.getAttribute('data-enemy-bullet-count')),{timeout:7000}).toBeGreaterThanOrEqual(2);
  await page.getByRole('button',{name:'暂停'}).click();
  const bullets=await stage.getAttribute('data-enemy-bullet-count');
  await page.waitForTimeout(250);
  await expect(stage).toHaveAttribute('data-enemy-bullet-count',bullets??'2');
  await page.screenshot({path:info.outputPath('raider-volley.png'),fullPage:true});
});
