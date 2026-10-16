import { test,expect } from '@playwright/test';

test('音频仅由用户启动解锁；音效/音乐可独立静音、本地持久化，失败不阻断玩法',async({page})=>{
  await page.addInitScript(()=>{
    const stats={contexts:0,tones:0,closed:0};
    (window as unknown as {__audioStats:typeof stats}).__audioStats=stats;
    class Node {
      gain={value:1,setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{},setTargetAtTime:()=>{}};
      frequency={value:1,setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}};
      type='sine';onended:((...args:never[])=>void)|null=null;
      connect(){return this;}disconnect(){}
      start(){stats.tones++;}
      stop(){this.onended?.();}
    }
    (window as unknown as {AudioContext:unknown}).AudioContext=class {
      state='running'; currentTime=0; destination=new Node();
      constructor(){stats.contexts++;}
      createGain(){return new Node();}
      createOscillator(){return new Node();}
      resume(){return Promise.resolve();}
      close(){stats.closed++;return Promise.resolve();}
    };
  });
  await page.route('**/levels/first-contact.json',async route=>{
    const response=await route.fetch();const json=await response.json();
    Object.assign(json.waves[0].formation,{rows:1,columns:1,startX:18,startY:10});
    json.waves[0].movement.horizontalSpeed=0;
    json.waves[0].attack.shotsPerMinute=0;
    await route.fulfill({response,json});
  });
  await page.goto('./');
  const count=async()=>page.evaluate(()=>
    (window as unknown as {__audioStats:{contexts:number;tones:number;closed:number}}).__audioStats);
  expect((await count()).contexts).toBe(0);
  await page.getByRole('button',{name:'音频'}).click();
  await expect(page.getByLabel('音效', {exact:true})).toBeChecked();
  await page.getByLabel('背景音乐').uncheck();
  await page.getByLabel('音量').fill('0.1');
  await page.getByRole('button',{name:'音频'}).click();
  expect((await count()).contexts).toBe(0);
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect.poll(async()=>(await count()).contexts).toBe(1);
  await page.keyboard.down('Space');
  await expect.poll(async()=>(await count()).tones,{timeout:6000}).toBeGreaterThan(1);
  await page.keyboard.up('Space');
  await expect(page.getByTestId('game-result')).toContainText('胜利',{timeout:9000});
  await page.reload();
  await page.getByRole('button',{name:'音频'}).click();
  await expect(page.getByLabel('背景音乐')).not.toBeChecked();
  await expect(page.getByLabel('音量')).toHaveValue('0.1');
  await page.getByLabel('音效', {exact:true}).uncheck();
  await page.getByRole('button',{name:'音频'}).click();
  await page.getByRole('button',{name:'开始',exact:true}).click();
  const before=(await count()).tones;
  await page.keyboard.down('Space');
  await expect(page.getByTestId('game-result')).toContainText('胜利',{timeout:9000});
  await page.keyboard.up('Space');
  expect((await count()).tones).toBe(before);
});

test('无 Web Audio 或拒绝本机存储时双关卡仍可开始和暂停',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});
    Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('storage denied');}});
  });
  await page.goto('./');
  await expect(page.getByTestId('webgl-status')).toContainText('WebGL 正常');
  await page.getByRole('button',{name:'开始',exact:true}).click();
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-game-phase','running');
  await page.getByRole('button',{name:'暂停'}).click();
  await expect(page.getByTestId('pause-message')).toBeVisible();
  await page.getByRole('button',{name:'继续'}).click();
  await page.getByRole('button',{name:'重置'}).click();
  await page.getByTestId('level-select').selectOption('crossfire');
  await expect(page.getByTestId('battlefield')).toHaveAttribute('data-total-waves','2');
});
