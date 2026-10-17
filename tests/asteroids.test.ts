import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AsteroidField,createAsteroidGeometry} from '../src/render/AsteroidField.ts';
import {combatProjection} from '../src/render/CombatProjection.ts';

test('四种真实不规则低模有唯一轮廓，避免照片/屏幕贴纸',()=>{
  const sizes=new Set<string>();
  for(let seed=17;seed<21;seed++){
    const geometry=createAsteroidGeometry(seed);
    assert.ok(geometry instanceof THREE.BufferGeometry);
    assert.equal(geometry.index,null,'原创独立切面应能分面受光');
    assert.ok(geometry.getAttribute('color').count>=60);
    const a=geometry.getAttribute('position');
    assert.ok(a.count>=60);
    const points=new THREE.Box3().setFromBufferAttribute(a);
    sizes.add(points.getSize(new THREE.Vector3()).toArray().map(n=>n.toFixed(3)).join('/'));
    geometry.dispose();
  }
  assert.equal(sizes.size,4);
});
test('12 块陨石固定只有四个实例批次，正常/竖屏/暂停/复位可重现',()=>{
  const layer=new THREE.Group();
  const asteroids=new AsteroidField(layer);
  assert.equal(asteroids.batches,5);
  assert.equal(layer.children.length,5);
  assert.equal(asteroids.totalCount,10);
  for(const obj of layer.children){
    assert.ok(obj instanceof THREE.InstancedMesh);
    assert.equal((obj as THREE.InstancedMesh).count,2);
    assert.equal(((obj as THREE.InstancedMesh).material as THREE.MeshStandardMaterial).map,null);
  }
  const layout=combatProjection({width:36,height:24},1280,720,false);
  asteroids.resize(layout,1280,720);
  assert.equal(asteroids.visibleCount,10);
  const mesh=layer.children[0] as THREE.InstancedMesh;
  const before=new THREE.Matrix4();mesh.getMatrixAt(0,before);
  asteroids.update(300);
  const moved=new THREE.Matrix4();mesh.getMatrixAt(0,moved);
  assert.ok(!before.equals(moved));
  asteroids.update(300);
  const frozen=new THREE.Matrix4();mesh.getMatrixAt(0,frozen);
  assert.ok(moved.equals(frozen));
  asteroids.update(0);
  const reset=new THREE.Matrix4();mesh.getMatrixAt(0,reset);
  assert.ok(before.equals(reset));
  asteroids.resize(combatProjection({width:36,height:24},390,844,true),390,844);
  assert.equal(asteroids.visibleCount,0);
  assert.ok(layer.children.every(mesh=>!mesh.visible));
  asteroids.dispose();
  assert.equal(layer.children.length,0);
});
