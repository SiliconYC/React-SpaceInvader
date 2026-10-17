import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CombatSceneLayers, SCENE_LAYER_ORDER, isSafeEdgeDecoration } from '../src/render/CombatSceneLayers.ts';

const world={width:36,height:24};
test('P3 场景层相互独立，战斗层最终绘制且 HUD 属于 DOM',()=>{
  const scene=new THREE.Scene();
  const layers=new CombatSceneLayers(scene);
  assert.deepEqual(SCENE_LAYER_ORDER,['starfield','celestial','environment','combat','foreground']);
  assert.equal(scene.children.length,5);
  assert.ok(layers.combat.renderOrder>layers.foreground.renderOrder);
  assert.ok(layers.foreground.renderOrder>layers.celestial.renderOrder);
  layers.dispose();
});
test('近景岩石不能跨入主战斗矩形、顶部 HUD、底部触控区',()=>{
  assert.equal(isSafeEdgeDecoration({left:4,top:180,right:50,bottom:240},world,1280,720,false),true);
  assert.equal(isSafeEdgeDecoration({left:620,top:250,right:680,bottom:320},world,1280,720,false),false);
  assert.equal(isSafeEdgeDecoration({left:1,top:0,right:40,bottom:50},world,1280,720,false),false);
  assert.equal(isSafeEdgeDecoration({left:1,top:660,right:40,bottom:700},world,1280,720,true),false);
  assert.equal(isSafeEdgeDecoration({left:0,top:180,right:50,bottom:240},world,390,844,true),false);
  assert.equal(isSafeEdgeDecoration({left:-1,top:180,right:50,bottom:240},world,1280,720,false),false);
  assert.equal(isSafeEdgeDecoration({left:NaN,top:180,right:50,bottom:240},world,1280,720,false),false);
});
test('前景模型默认隐藏并重新计算安全区；不写深度且资源可释放',()=>{
  const scene=new THREE.Scene();
  const layers=new CombatSceneLayers(scene);
  const geometry=new THREE.BoxGeometry(1,1,1);
  const baseMaterial=new THREE.MeshBasicMaterial({color:0xffffff});
  const mesh=new THREE.Mesh(geometry,baseMaterial);
  layers.addForeground(mesh,()=>({left:4,top:180,right:50,bottom:240}));
  assert.equal(mesh.visible,false);
  assert.notEqual(mesh.material,baseMaterial);
  assert.equal((mesh.material as THREE.Material).depthTest,false);
  assert.equal((mesh.material as THREE.Material).depthWrite,false);
  layers.refresh(world,new THREE.PerspectiveCamera(),1280,720,false);
  assert.equal(mesh.visible,true);
  layers.refresh(world,new THREE.PerspectiveCamera(),390,844,true);
  assert.equal(mesh.visible,false);
  assert.equal(layers.visibleForegroundCount,0);
  layers.dispose();
  geometry.dispose();baseMaterial.dispose();
});
