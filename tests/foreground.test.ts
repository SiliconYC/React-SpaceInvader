import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CombatSceneLayers } from '../src/render/CombatSceneLayers.ts';
import { ForegroundRocks } from '../src/render/ForegroundRocks.ts';
import { combatProjection } from '../src/render/CombatProjection.ts';

test('P3/C4: 四块真实低模三维边缘岩石共享 #44 生成器，全部经过 #36 安全门禁',()=>{
  const world={width:36,height:24};
  const scene=new THREE.Scene();
  const layers=new CombatSceneLayers(scene);
  const foreground=new ForegroundRocks(layers,world);
  const projection=combatProjection(world,1280,720,false);
  const camera=new THREE.OrthographicCamera(
    -projection.spanX/2,projection.spanX/2,projection.spanY/2,-projection.spanY/2,.1,200);
  camera.position.set(0,projection.centerY,50);
  camera.lookAt(0,projection.centerY,0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  assert.equal(foreground.count,4);
  assert.equal(layers.foreground.children.length,4);
  for(const item of layers.foreground.children){
    assert.ok(item instanceof THREE.Mesh);
    assert.ok(item.geometry instanceof THREE.IcosahedronGeometry);
    assert.ok(item.material instanceof THREE.MeshStandardMaterial);
    assert.equal(item.material.depthTest,false);
    assert.equal(item.material.depthWrite,false);
    assert.equal(item.material.transparent,false);
    assert.equal(item.visible,false);
  }
  foreground.resize(projection,camera,1280,720);
  layers.refresh(world,camera,1280,720,false);
  assert.ok(foreground.visibleCount>0,'widescreen safe edge has at least one visible rock');
  const mesh=layers.foreground.children[0] as THREE.Mesh;
  const initial=mesh.rotation.clone();
  foreground.update(450);
  assert.notEqual(mesh.rotation.y,initial.y);
  const paused=mesh.rotation.y;
  foreground.update(450);
  assert.equal(mesh.rotation.y,paused);
  foreground.update(0,true);
  assert.equal(mesh.rotation.y,initial.y);
  foreground.resize(combatProjection(world,390,844,true),camera,390,844);
  layers.refresh(world,camera,390,844,true);
  assert.equal(foreground.visibleCount,0);
  foreground.dispose();layers.dispose();
  assert.equal(layers.foreground.children.length,0);
});
