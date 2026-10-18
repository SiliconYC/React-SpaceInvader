// node --experimental-strip-types scripts/export-ship-occlusion.mjs /tmp/ships-for-ao.json
// Geometry stays authored in ShipModels.ts; this is only the offline bake input.
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createShipTemplates} from '../src/render/ShipModels.ts';
const resources=[];const t=createShipTemplates(resources);const ships={};
for(const [kind,group] of Object.entries({player:t.player,...t.enemies})){
  ships[kind]=group.children.map(m=>{
    m.updateMatrix();const geo=m.geometry;
    const hash=createHash('sha256').update(JSON.stringify([Array.from(geo.attributes.position.array),Array.from(geo.attributes.normal.array),m.matrix.elements])).digest('hex');
    const p=geo.attributes.position,n=geo.attributes.normal,nm=new THREE.Matrix3().getNormalMatrix(m.matrix);
    const positions=[],normals=[],v=new THREE.Vector3();
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(m.matrix);positions.push(...v.toArray());
      v.fromBufferAttribute(n,i).applyNormalMatrix(nm);normals.push(...v.toArray());
    }
    return {name:m.name,hash,positions,normals,indices:geo.index?Array.from(geo.index.array):Array.from({length:p.count},(_,i)=>i)};
  });
}
writeFileSync(process.argv[2]??'/tmp/ships-for-ao.json',JSON.stringify(ships));
resources.forEach(r=>r.dispose());
