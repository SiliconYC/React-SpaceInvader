import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RingedPlanet} from '../src/render/RingedPlanet.ts';
import {combatProjection} from '../src/render/CombatProjection.ts';

test('真低模球体 + 倾斜 RingGeometry 且正反面由深度测试遮挡',()=>{
  const g=new THREE.Group(),p=new RingedPlanet(g);
  assert.equal(p.meshes,3);
  assert.ok(p.outerRing.geometry instanceof THREE.RingGeometry);
  assert.equal(p.outerRing.material.depthWrite,false);
  assert.ok(p.sphere.geometry instanceof THREE.BufferGeometry);
  assert.ok(p.sphere.geometry.getAttribute('position').count>500);
  assert.ok(p.sphere.geometry.getAttribute('color').count>500);
  assert.ok(p.ring.geometry instanceof THREE.RingGeometry);
  assert.ok(p.sphere.material instanceof THREE.MeshStandardMaterial);
  assert.ok(p.ring.material instanceof THREE.MeshStandardMaterial);
  assert.equal(p.sphere.material.depthWrite,true);
  assert.equal(p.ring.material.depthTest,true);
  assert.equal(p.ring.material.side,THREE.DoubleSide);
  assert.ok(Math.abs(p.ring.rotation.x)>.2);
  assert.equal(g.children[0],p.group);
  assert.equal(p.group.position.z,-18);
  p.dispose();assert.equal(g.children.length,0);
});
test('球体尺寸随视口减小，绕转仅更改姿态不修改 XY 规则数据',()=>{
  const g=new THREE.Group(),p=new RingedPlanet(g);
  const world={width:36,height:24};
  p.resize(combatProjection(world,1280,720,false),1280,720);
  const size=p.group.scale.x,position=p.group.position.clone();
  p.update(360);
  assert.ok(p.group.rotation.y>.13);
  assert.ok(p.group.position.equals(position));
  p.update(0,true);assert.ok(Math.abs(p.sphere.rotation.y)<.000001);
  p.resize(combatProjection(world,390,844,true),390,844);
  assert.ok(p.group.scale.x<size);
  assert.ok(p.group.position.z<0);
  p.dispose();
});
test('窄幅横屏把行星移出右上角暂停/重置控件区域',()=>{
  const g=new THREE.Group(),p=new RingedPlanet(g),world={width:36,height:24};
  p.resize(combatProjection(world,1920,1080,false),1920,1080);
  const desktopX=p.group.position.x;
  p.resize(combatProjection(world,844,390,true),844,390);
  assert.ok(desktopX>0,'宽屏桌面仍将行星安排在右侧');
  assert.ok(p.group.position.x<0,'窄横屏将行星移到左上装饰区，避免压住右上角操作键');
  p.dispose();
});
