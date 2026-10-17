import * as THREE from 'three';

/** P3 shared authored visual palette. Colors are sRGB hex inputs to Three.js. */
export const P3_COLORS = Object.freeze({
  space:0x07152b, plum:0x221a43,
  ceramic:0xe9f5fc, playerBlue:0x62c5e4, playerDeep:0x287ca6,
  canopy:0x143959, thrust:0x58ddf3,
  scout:0xffb86b, scoutTrim:0xffd49b,
  raider:0xe67a7d, raiderTrim:0xffc7af,
  guardian:0xa99adf, guardianTrim:0xd5c5ff,
  distantStone:0x46516f,
  playerShot:0xbef4fc, enemyShot:0xffba9e,
  hit:0xffd18b,
} as const);

/** P4 deliberately retains NO bloom, screen-space shadows or extra render targets. */
export type P4LightVariant='studio'|'soft';
export function p4LightVariantFromSearch(search:string):P4LightVariant {
  return new URLSearchParams(search).get('light')==='soft'?'soft':'studio';
}
/** Studio is the production candidate; soft reproduces the flatter P3-like alternative. */
export const P3_LIGHTING = Object.freeze({
  toneMappingExposure:1.07,
  ambient:0.23,
  hemisphere:0.66,
  key:1.85,
  rim:0.43,
  armorRoughness:0.54,
  armorMetalness:0.12,
  emissiveAccent:0.63,
} as const);

export function installP3Lighting(scene:THREE.Scene,variant:P4LightVariant='studio'):readonly THREE.Light[] {
  const studio=variant==='studio';
  const fill=new THREE.AmbientLight(0xa9bdd2,studio?P3_LIGHTING.ambient:.33);
  const sky=new THREE.HemisphereLight(0xd9ebfa,0x151e3d,studio?P3_LIGHTING.hemisphere:.77);
  const key=new THREE.DirectionalLight(0xffeddd,studio?P3_LIGHTING.key:1.8);
  key.position.set(-9,13,16);
  const rim=new THREE.DirectionalLight(0x8ba8e5,studio?P3_LIGHTING.rim:.44);
  rim.position.set(9,-6,9);
  for(const light of [fill,sky,key,rim])scene.add(light);
  return [fill,sky,key,rim];
}
