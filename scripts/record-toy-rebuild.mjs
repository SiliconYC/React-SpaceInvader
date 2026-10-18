/** Continuous real-time Chromium recording + software FPS comparison.
 * node scripts/record-toy-rebuild.mjs URL OUTPUT_DIR
 * No fake state, frame interpolation or speed-up. No physical GPU claim.
 */
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
const [base,out]=process.argv.slice(2);if(!base||!out)throw new Error('URL OUTPUT_DIR required');
mkdirSync(out,{recursive:true});
const metal=process.env.TOY_GPU==='metal';
const browser=await chromium.launch(metal?{channel:'chrome',args:['--use-angle=metal']}:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,
   recordVideo:{dir:out,size:{width:1920,height:1080}}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const start=Date.now();await page.goto(base);
 await page.getByRole('button',{name:'开始',exact:true}).waitFor({timeout:30000});
 const readyMs=Date.now()-start;
 const hardware=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
 await page.getByRole('button',{name:'开始',exact:true}).click();
 const frameMs=await page.evaluate(async()=>{
   const times=[];await new Promise(resolve=>{const start=performance.now();
   const sample=now=>{times.push(now);if(now-start>3000)resolve();else requestAnimationFrame(sample);};requestAnimationFrame(sample);});
   return times.slice(1).map((v,i)=>v-times[i]);
 });
 const measurementStage=await page.getByTestId('battlefield').evaluate(el=>({...el.dataset}));
 await page.keyboard.down('Space');
 for(const key of ['ArrowRight','ArrowLeft','ArrowRight','ArrowLeft']){
   await page.keyboard.down(key);await page.waitForTimeout(1600);await page.keyboard.up(key);
   await page.waitForTimeout(500);
 }
 await page.waitForTimeout(3000);
 await page.keyboard.up('Space');
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 const d=await page.getByTestId('battlefield').evaluate(el=>({...el.dataset}));
 await page.screenshot({path:out+'/combat-paused.png'});
 frameMs.sort((a,b)=>a-b);const mean=frameMs.reduce((a,b)=>a+b,0)/frameMs.length;
 const video=page.video();await context.close();const raw=await video.path();await video.saveAs(out+'/combat.webm');unlinkSync(raw);
 writeFileSync(out+'/performance.json',JSON.stringify({browser:browser.version(),viewport:'1920x1080 DPR1',
   hardware,renderer:metal?'Local desktop Chrome Metal; not phone hardware':'Chromium SwiftShader software GPU; not phone hardware',readyMs,samples:frameMs.length,
   fps:1000/mean,p50ms:frameMs[Math.floor(frameMs.length*.5)],p95ms:frameMs[Math.floor(frameMs.length*.95)],
   errors,stage:measurementStage,endStage:d},null,2)+'\n');
}finally{await browser.close();}
