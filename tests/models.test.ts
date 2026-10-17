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

test('P3 玩家模型为多层可编辑 Three.js 实体，尺寸与 XY 命中盒独立',()=>{
  const resources: Array<THREE.BufferGeometry | THREE.Material>=[];
  const {player}=createShipTemplates(resources);
  const body=player.children.filter(x=>x instanceof THREE.Mesh) as THREE.Mesh[];
  assert.ok(body.length>=14);
  assert.equal(player.position.z,0);
  assert.equal(player.userData.assetSource,'src/render/ShipModels.ts#q-player-pivot');
  const bounds=new THREE.Box3().setFromObject(player);
  assert.ok(bounds.max.z-bounds.min.z>.4,'凸起的座舱必须具备真实厚度');
  assert.ok(bounds.max.x-bounds.min.x<=2.5,'模型必须位于原有玩家 XY 宽度边界');
  assert.ok(bounds.max.x-bounds.min.x>=2.1);
  assert.ok(body.some(mesh=>mesh.geometry instanceof THREE.SphereGeometry),'真实圆润体积，不是平面贴图');
  assert.ok(body.some(mesh=>mesh.geometry instanceof THREE.ExtrudeGeometry),'机翼有真实厚度');
  assert.ok(body.every(mesh=>(mesh.material as THREE.Material).map===undefined),'不依赖贴图');
  const before=player.position.clone();
  player.rotation.set(.2,-.2,.2);
  assert.ok(player.position.equals(before),'三轴姿态只能影响可视模型，不更新逻辑位置');
  resources.forEach(resource=>resource.dispose());
});
