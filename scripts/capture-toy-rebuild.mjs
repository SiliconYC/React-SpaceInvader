/** Real Chromium evidence. No mocked levels, hidden DOM, edited canvas or zoomed
 * battle screenshot. Only the documented model preview uses a close-up lens.
 * node scripts/capture-toy-rebuild.mjs URL OUTPUT_DIR
 */
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.argv[2],out=process.argv[3];
if(!base||!out)throw new Error('URL and output directory required');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const measurements=[];
async function capture(name,viewport,query='',touch=false){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:touch,hasTouch:touch});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-19T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-19T00:00:01Z'));
  await page.goto(base+query);
  await page.getByTestId('webgl-status').filter({hasText:'WebGL 正常'}).waitFor({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('[data-testid="battlefield"]')?.dataset.galaxy==='loaded');
  // Baseline has no studio map; latest must finish the actual image load.
  await page.waitForFunction(()=>{const d=document.querySelector('[data-testid="battlefield"]')?.dataset;return !d?.studioEnvironment||d.studioEnvironment==='loaded';});
  await page.clock.runFor(100);
  if(!query){await page.getByRole('button',{name:'开始',exact:true}).click({force:true});await page.clock.runFor(17);await page.clock.fastForward(1000);}
  const stage=await page.getByTestId('battlefield').evaluate(el=>({...el.dataset}));
  // CDP captures the last real frame without advancing the deliberately frozen
  // requestAnimationFrame clock merely to satisfy screenshot style settling.
  const cdp=await context.newCDPSession(page);
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
  writeFileSync(out+'/'+name+'.png',Buffer.from(shot.data,'base64'));
  measurements.push({name,viewport,touch,query,errors,stage});
  await context.close();
}
try{
  for(const viewport of [{width:1920,height:1080},{width:1440,height:900},{width:844,height:390},{width:390,height:844}]){
    await capture('battle-'+viewport.width+'x'+viewport.height,viewport,'',viewport.width<1000);
  }
  for(const kind of ['player','scout','raider','guardian'])await capture('closeup-'+kind,{width:1440,height:900},'?shipPreview='+kind+'&shipAngle=tilt');
  writeFileSync(out+'/capture.json',JSON.stringify({base,browser:browser.version(),gpu:'Chromium SwiftShader; not physical phone GPU',clock:'ready 100 ms, running 17 ms, fastForward 1000 ms; one capped 0.25 s engine advance; see stage foregroundMotion for exact tick',measurements},null,2)+'\n');
}finally{await browser.close();}
