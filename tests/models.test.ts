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
  assert.ok(body.every(mesh=>(mesh.material as THREE.MeshStandardMaterial).map==null),'不依赖贴图');
  const before=player.position.clone();
  player.rotation.set(.2,-.2,.2);
  assert.ok(player.position.equals(before),'三轴姿态只能影响可视模型，不更新逻辑位置');
  resources.forEach(resource=>resource.dispose());
});

test('P3 三种 Q 敌机灰度剪影不同，真实厚度且每类复用源网格',()=>{
  const resources: Array<THREE.BufferGeometry|THREE.Material>=[];
  const {enemies}=createShipTemplates(resources);
  const dims=(ship:THREE.Group)=>new THREE.Box3().setFromObject(ship).getSize(new THREE.Vector3());
  const [s,r,g]=[dims(enemies.scout),dims(enemies.raider),dims(enemies.guardian)];
  assert.ok(s.x<r.x && r.x<g.x,'Scout/突击/守卫必须有不同横向轮廓');
  assert.ok(g.z>r.z && r.z>s.z,'厚重程度要真正来自实体 z 几何');
  for(const kind of ['scout','raider','guardian'] as const) {
    const group=enemies[kind];
    const meshes=group.children as THREE.Mesh[];
    assert.ok(meshes.length>=7,'多个共享大部件形成真实多面体');
    assert.ok(meshes.every(m=>m instanceof THREE.Mesh));
    assert.ok(meshes.every(m=>(m.material as THREE.MeshStandardMaterial).map==null));
    assert.equal(group.userData.assetSource,'src/render/ShipModels.ts#'+kind);
    const instanced=meshes.map(m=>new THREE.InstancedMesh(m.geometry,m.material,256));
    const originalCount=resources.length;
    for(let i=0;i<24;i++)instanced.forEach(m=>m.setMatrixAt(i,new THREE.Matrix4().makeTranslation(i,0,0)));
    assert.equal(resources.length,originalCount,'实例化不能每架分配贴图、材质或网格');
    instanced.forEach(m=>m.dispose());
  }
  resources.forEach(item=>item.dispose());
});
