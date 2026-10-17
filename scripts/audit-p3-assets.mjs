import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const check=(path,predicate,label)=>{
  const bytes=readFileSync(resolve(root,path));
  assert.ok(predicate(bytes),label+': '+path);
  return {path,bytes:bytes.length};
};
const existsText=(path,required)=>{
  const source=readFileSync(resolve(root,path),'utf8');
  for(const token of required)assert.ok(source.includes(token),'missing '+token+' in '+path);
  return {path,bytes:Buffer.byteLength(source),verified:required};
};
const png=check('public/art/backgrounds/galaxy-v2-source.png',bytes=>
  bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'real PNG signature');
const webp=check('public/art/backgrounds/galaxy-v2.webp',bytes=>
  bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP','real WebP signature');
assert.ok(webp.bytes<300*1024,'runtime starfield should remain below 300 KiB');
const reference=check('docs/art/reference/p3-lowpoly-q-concept.svg',bytes=>
  bytes.toString('utf8').includes('<svg'),'editable vector concept');
const geometry=[
  existsText('src/render/ShipModels.ts',['ExtrudeGeometry','SphereGeometry','q-player-pivot','guardian']),
  existsText('src/render/RingedPlanet.ts',['SphereGeometry','RingGeometry','new THREE.Mesh']),
  existsText('src/render/AsteroidField.ts',['IcosahedronGeometry','InstancedMesh']),
  existsText('src/render/ForegroundRocks.ts',['createAsteroidGeometry','addForeground']),
  existsText('src/render/BattlefieldRenderer.ts',['InstancedMesh','renderer.render','effects.dispose()','galaxy.dispose()']),
  existsText('src/render/GalaxyBackdrop.ts',['TextureLoader','colorSpace','texture?.dispose()']),
  existsText('src/levels/visualThemes.ts',['nebula-blue','violet-drift','resolveVisualTheme']),
];
const levels=['first-contact','crossfire'].map(id=>{
  const payload=JSON.parse(readFileSync(resolve(root,'public/levels/'+id+'.json'),'utf8'));
  assert.equal(payload.schemaVersion,1);
  assert.ok(['nebula-blue','violet-drift'].includes(payload.visualTheme));
  assert.equal(payload.world.width,36);
  assert.equal(payload.world.height,24);
  return {id,visualTheme:payload.visualTheme,waves:payload.waves.length};
});
const report={
  audit:'P3 original editable reference, actual on-disk art and live Three.js source',
  sourceImage:png,runtimeImage:webp,reference,
  editableThreeSources:geometry,levels,
  constraints:{runtimeBytesUnder300KiB:true,modelsAreNotScreenshots:true,
    actualWebGLProof:'tests/p3-final.browser.spec.ts and Pages CI artifacts',
    manualVisualMatch:'UNVERIFIED: supplied original second concept image is not identical to in-repo redraw',
    realMobileGPU:'UNVERIFIED: CI uses software Chromium SwiftShader'},
};
mkdirSync(resolve(root,'artifacts'),{recursive:true});
writeFileSync(resolve(root,'artifacts/p3-asset-audit.json'),JSON.stringify(report,null,2));
console.log('P3 asset/source audit:',JSON.stringify({png:png.bytes,webp:webp.bytes,
  reference:reference.bytes,sources:geometry.length,levels}));
