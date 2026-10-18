/** Offline bake of the bundled Three.js studio. No browser startup-time PMREM.
 * npm run dev -- --port 4199
 * node scripts/bake-studio-environment.mjs
 * Three.js RoomEnvironment is MIT licensed (node_modules/three/LICENSE).
 * Output is an sRGB-encoded, range-scaled PRE-FILTERED CubeUV atlas; no mipmaps.
 */
import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage();
  await page.goto(process.env.BAKE_BASE_URL??'http://127.0.0.1:4199/React-SpaceInvader/');
  const result=await page.evaluate(async()=>{
    const THREE=await import('/React-SpaceInvader/node_modules/three/build/three.module.js');
    const {RoomEnvironment}=await import('/React-SpaceInvader/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
    const renderer=new THREE.WebGLRenderer({antialias:false});
    const room=new RoomEnvironment();const generator=new THREE.PMREMGenerator(renderer);
    const target=generator.fromScene(room,.04);const {width,height}=target;
    const pixels=new Uint16Array(width*height*4);
    renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
    let maximum=0;for(let i=0;i<pixels.length;i++)if(i%4!==3)maximum=Math.max(maximum,THREE.DataUtils.fromHalfFloat(pixels[i]));
    const range=Math.pow(2,Math.ceil(Math.log2(maximum)));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');const image=context.createImageData(width,height);
    const srgb=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
    for(let i=0;i<pixels.length;i++)image.data[i]=i%4===3?255:Math.round(srgb(THREE.DataUtils.fromHalfFloat(pixels[i])/range)*255);
    context.putImageData(image,0,0);
    const png=canvas.toDataURL('image/png').split(',')[1];
    target.dispose();generator.dispose();room.dispose();renderer.dispose();
    return {png,width,height,range,maximum};
  });
  const bytes=Buffer.from(result.png,'base64');
  writeFileSync('public/art/studio-cubeuv.png',bytes);
  const {png,...metadata}=result;
  writeFileSync('docs/art/studio-cubeuv.json',JSON.stringify({generator:'scripts/bake-studio-environment.mjs',...metadata,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');
  console.log(metadata);
}finally{await browser.close();}
