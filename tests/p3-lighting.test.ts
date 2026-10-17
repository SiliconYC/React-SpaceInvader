import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { P3_COLORS,P3_LIGHTING,installP3Lighting } from '../src/render/P3Palette.ts';
import { createShipTemplates } from '../src/render/ShipModels.ts';

test('P3/D1 palette is restrained, opaque, asset-free and stable for shared instanced meshes',()=>{
  const scene=new THREE.Scene();
  const lights=installP3Lighting(scene);
  assert.equal(lights.length,4);
  assert.ok(lights.every(light=>light.intensity<2));
  assert.ok(P3_LIGHTING.toneMappingExposure<1.15);
  const resources: Array<THREE.BufferGeometry|THREE.Material>=[];
  const {player,enemies}=createShipTemplates(resources);
  const meshes=[...player.children,...Object.values(enemies).flatMap(x=>x.children)] as THREE.Mesh[];
  const mats=[...new Set(meshes.map(x=>x.material as THREE.MeshStandardMaterial))];
  assert.ok(mats.length<25);
  assert.ok(mats.every(m=>m instanceof THREE.MeshStandardMaterial && m.map===null && m.roughness>=.28));
  assert.ok(mats.filter(m=>m.emissive.getHex()!==0 && m.emissiveIntensity>=.6).length<8,'glow only for small accents');
  assert.ok(mats.some(m=>m.color.getHex()===P3_COLORS.ceramic));
  assert.ok(mats.some(m=>m.color.getHex()===P3_COLORS.scout));
  assert.ok(mats.some(m=>m.color.getHex()===P3_COLORS.raider));
  assert.ok(mats.some(m=>m.color.getHex()===P3_COLORS.guardian));
  resources.forEach(x=>x.dispose());
});
