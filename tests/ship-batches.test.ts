import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createShipTemplates } from '../src/render/ShipModels.ts';
import { shipRenderParts } from '../src/render/ShipBatches.ts';

test('刚性零件按材质合批仍保持世界几何，机械动作部件保留独立 pivot',()=>{
  const resources:Array<THREE.BufferGeometry|THREE.Material>=[];
  const {player,enemies}=createShipTemplates(resources);
  for(const source of [player,...Object.values(enemies)]){
    const moving=new Set(['engine-core','left-toy-wing-inlay','right-toy-wing-inlay',
      'scout-main-single-optic','scout-eye-catchlight','raider-muzzle-emitter',
      'guardian-three-dimensional-energy-lens']);
    const parts=shipRenderParts(source,resources,moving);
    assert.ok(parts.length<source.children.length,'共享材质必须减少实际绘制批次');
    const before=new THREE.Box3().setFromObject(source,true);
    const after=new THREE.Box3().setFromObject(new THREE.Group().add(...parts),true);
    assert.ok(before.min.distanceTo(after.min)<.00001 && before.max.distanceTo(after.max)<.00001);
    for(const name of moving){
      const originals=source.children.filter(p=>p.name===name);
      const kept=parts.filter(p=>p.name===name);
      assert.equal(kept.length,originals.length);
      originals.forEach((p,i)=>assert.ok(kept[i].position.equals(p.position)));
    }
    assert.ok(parts.every(p=>p.castShadow&&p.receiveShadow));
  }
  resources.forEach(r=>r.dispose());
});
