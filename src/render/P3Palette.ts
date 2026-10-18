import * as THREE from 'three';

/** P3 shared authored visual palette. Colors are sRGB hex inputs to Three.js. */
export const P3_COLORS = Object.freeze({
  space:0x07152b, plum:0x221a43,
  ceramic:0xe9f5fc, playerBlue:0x62c5e4, playerDeep:0x287ca6,
  canopy:0x143959, thrust:0x58ddf3,
  scout:0xf99944, scoutTrim:0xffd49b,
  raider:0xe85f69, raiderTrim:0xffc7af,
  guardian:0x9b81d7, guardianTrim:0xd5c5ff,
  distantStone:0x46516f,
  playerShot:0xbef4fc, enemyShot:0xffba9e,
  hit:0xffd18b,
} as const);

/** No bloom or screen-space postprocessing; one directional shadow map gives real contact. */
export type P4LightVariant='studio'|'soft';
export function p4LightVariantFromSearch(search:string):P4LightVariant {
  return new URLSearchParams(search).get('light')==='soft'?'soft':'studio';
}
/** Studio is the production candidate; soft reproduces the flatter P3-like alternative. */
export const P3_LIGHTING = Object.freeze({
  toneMappingExposure:1.07,
  ambient:0.12,
  hemisphere:0.42,
  key:1.95,
  rim:0.32,
  armorRoughness:0.54,
  armorMetalness:0.12,
  emissiveAccent:0.63,
} as const);

export function installP3Lighting(scene:THREE.Scene,variant:P4LightVariant='studio'):readonly THREE.Light[] {
  const studio=variant==='studio';
  const fill=new THREE.AmbientLight(0xc3d4e5,studio?P3_LIGHTING.ambient:.33);
  const sky=new THREE.HemisphereLight(0xf0ffef,0x28345e,studio?P3_LIGHTING.hemisphere:.77);
  const key=new THREE.DirectionalLight(0xffedcd,studio?P3_LIGHTING.key:1.8);
  key.position.set(-16,19,13);
  key.castShadow=studio;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.left=-24;key.shadow.camera.right=24;
  key.shadow.camera.top=20;key.shadow.camera.bottom=-20;
  key.shadow.camera.near=1;key.shadow.camera.far=65;
  key.shadow.bias=-.00015;key.shadow.normalBias=.012;
  key.shadow.intensity=.72;
  key.shadow.camera.updateProjectionMatrix();
  const rim=new THREE.DirectionalLight(0x95efff,studio?P3_LIGHTING.rim:.44);
  rim.position.set(9,-6,9);
  for(const light of [fill,sky,key,rim])scene.add(light);
  return [fill,sky,key,rim];
}
