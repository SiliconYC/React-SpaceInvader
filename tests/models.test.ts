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

test('P4/A2 连续原创建模：机身/两侧翼型均为独立的有法线三维曲面',()=>{
  const resources:Array<THREE.BufferGeometry|THREE.Material>=[];
  const {player}=createShipTemplates(resources);
  const meshes=player.children.filter(x=>x instanceof THREE.Mesh) as THREE.Mesh[];
  assert.ok(meshes.length>=14);
  const fuselage=meshes.find(x=>x.name==='continuous-ceramic-fuselage');
  const wing=meshes.filter(x=>x.name.endsWith('main-airfoil'));
  assert.ok(fuselage&&wing.length===2,'真正连续机身与双翼而不是复制旧 BoxGeometry');
  assert.equal(fuselage!.geometry.type,'BufferGeometry');
  for(const mesh of [fuselage!,...wing]){
    assert.ok(mesh.geometry.getAttribute('normal').count>20);
    const bbox=new THREE.Box3().setFromObject(mesh);
    assert.ok(bbox.max.z>bbox.min.z);
  }
  assert.equal(meshes.filter(x=>x.name==='engine-core').length,2);
  assert.ok(meshes.some(x=>x.name==='single-polished-raised-canopy'));
  const bounds=new THREE.Box3().setFromObject(player);
  assert.ok(bounds.max.x-bounds.min.x<=2.5);
  assert.equal(player.position.z,0);
  resources.forEach(r=>r.dispose());
});

test('P4/A3 Scout 在 24/40 架情况下共用实体翼型与镜头可见单眼',()=>{
  const resources:Array<THREE.BufferGeometry|THREE.Material>=[];
  const {enemies}=createShipTemplates(resources);
  const scout=enemies.scout;
  const wing=(scout.children as THREE.Mesh[]).filter(x=>x.name.endsWith('airfoil'));
  assert.equal(wing.length,2);
  assert.ok(wing.every(x=>x.geometry instanceof THREE.BufferGeometry && x.geometry.getAttribute('normal').count>20));
  assert.ok((scout.children as THREE.Mesh[]).some(x=>x.name==='scout-main-single-optic'));
  const dims=new THREE.Box3().setFromObject(scout).getSize(new THREE.Vector3());
  assert.ok(dims.x>1.7&&dims.x<2.1);
  const m=(scout.children as THREE.Mesh[]).map(x=>new THREE.InstancedMesh(x.geometry,x.material,40));
  m.forEach(x=>{
    for(let i=0;i<40;i++)x.setMatrixAt(i,new THREE.Matrix4().makeTranslation(i,0,0));
    x.dispose();
  });
  resources.forEach(x=>x.dispose());
});


test('#101 商业玩具形体：大独眼、圆肩双炮、厚盾、原始 XY 边界不改',()=>{
  const resources:Array<THREE.BufferGeometry|THREE.Material>=[];
  const {player,enemies}=createShipTemplates(resources);
  const mesh=(ship:THREE.Group,name:string)=>ship.children.find(m=>m.name===name) as THREE.Mesh|undefined;
  const bound=(ship:THREE.Group)=>new THREE.Box3().setFromObject(ship).getSize(new THREE.Vector3());
  assert.ok(mesh(player,'canopy-catchlight'),'玩家座舱具有独立可控的形体亮面');
  assert.ok(mesh(player,'left-toy-wing-inlay')&&mesh(player,'right-toy-wing-inlay'));
  assert.ok(mesh(enemies.scout,'scout-creamy-eye-surround'));
  assert.ok(mesh(enemies.scout,'scout-main-single-optic'));
  assert.ok(mesh(enemies.raider,'raider-muzzle-emitter'));
  assert.ok(mesh(enemies.guardian,'guardian-three-dimensional-energy-lens'));
  assert.ok(bound(enemies.guardian).z>bound(enemies.raider).z);
  assert.ok(bound(enemies.raider).z>bound(enemies.scout).z);
  assert.ok(bound(player).x<=2.5&&bound(enemies.scout).x<2.1);
  assert.ok([player,...Object.values(enemies)].every(g=>g.children.every(x=>x instanceof THREE.Mesh)));
  resources.forEach(x=>x.dispose());
});

test('四机型接触遮蔽来自当前真实网格，源变更不能误用过期烘焙',async()=>{
  const {createHash}=await import('node:crypto');
  const {SHIP_OCCLUSION_HASHES}=await import('../src/render/ShipOcclusion.ts');
  const resources:Array<THREE.BufferGeometry|THREE.Material>=[];
  const t=createShipTemplates(resources);
  for(const [kind,g] of Object.entries({player:t.player,...t.enemies})){
    let shaded=0;
    g.children.forEach((part,index)=>{
      const m=part as THREE.Mesh;m.updateMatrix();
      const p=m.geometry.getAttribute('position'),n=m.geometry.getAttribute('normal');
      const hash=createHash('sha256').update(JSON.stringify([Array.from(p.array),Array.from(n.array),m.matrix.elements])).digest('hex');
      assert.equal(SHIP_OCCLUSION_HASHES[kind+'/'+index],hash,'模型更新后须重新烘焙 AO');
      const ao=m.geometry.getAttribute('color');
      assert.ok(ao&&ao.count===p.count,'烘焙必须实际附着于当前顶点');
      const values=Array.from(ao.array);
      shaded+=values.filter(v=>v<245).length;
      assert.ok(Math.max(...values)>100,'遮蔽不能让零件变黑');
    });
    assert.ok(shaded>100,'实体接缝须有接触遮蔽，而非全白占位数据');
  }
  resources.forEach(r=>r.dispose());
});
