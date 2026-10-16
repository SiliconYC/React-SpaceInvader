import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createShipTemplates } from '../src/render/ShipModels.ts';

test('四种原创三维单位造型结构不同，敌机 clone 共用 GPU 资源', () => {
  const resources: Array<THREE.BufferGeometry | THREE.Material> = [];
  const {player,enemies} = createShipTemplates(resources);
  assert.ok(player.children.length >= 4);
  assert.ok(enemies.scout.children.length >= 3);
  assert.ok(enemies.raider.children.length >= 4);
  assert.ok(enemies.guardian.children.length >= 5);
  const silhouettes = [enemies.scout,enemies.raider,enemies.guardian].map(group => {
    const box = new THREE.Box3().setFromObject(group);
    return [box.min.x.toFixed(2),box.max.x.toFixed(2),box.max.z.toFixed(2),group.children.length].join(':');
  });
  assert.equal(new Set(silhouettes).size,3);
  const first = enemies.guardian.clone(true);
  const second = enemies.guardian.clone(true);
  assert.ok(first.children[0] instanceof THREE.Mesh);
  assert.equal((first.children[0] as THREE.Mesh).geometry, (second.children[0] as THREE.Mesh).geometry);
  assert.equal((first.children[0] as THREE.Mesh).material, (second.children[0] as THREE.Mesh).material);
  const count=resources.length;
  for(let i=0;i<200;i++) enemies.scout.clone(true);
  assert.equal(resources.length,count);
  resources.forEach(x=>x.dispose());
});
