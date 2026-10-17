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

/** No screen-space bloom, shadows, extra render targets or texture dependencies. */
export const P3_LIGHTING = Object.freeze({
  toneMappingExposure:1.07,
  ambient:0.33,
  hemisphere:0.77,
  key:1.8,
  rim:0.44,
  armorRoughness:0.66,
  armorMetalness:0.09,
  emissiveAccent:0.78,
} as const);

export function installP3Lighting(scene:THREE.Scene):readonly THREE.Light[] {
  const fill=new THREE.AmbientLight(0x9fb8d4,P3_LIGHTING.ambient);
  const sky=new THREE.HemisphereLight(0xc5e4f3,0x1d2441,P3_LIGHTING.hemisphere);
  const key=new THREE.DirectionalLight(0xffe9d6,P3_LIGHTING.key);
  key.position.set(-9,13,16);
  const rim=new THREE.DirectionalLight(0x94b7ed,P3_LIGHTING.rim);
  rim.position.set(9,-6,9);
  for(const light of [fill,sky,key,rim])scene.add(light);
  return [fill,sky,key,rim];
}
