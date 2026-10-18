import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Bake only rigid LOCAL part transforms, then merge by material. Animated pivots
 * stay separate; enemies still instance the resulting parts across the fleet. */
export function shipRenderParts(source:THREE.Group,resources:Array<THREE.BufferGeometry|THREE.Material>,
  moving:ReadonlySet<string>):THREE.Mesh[] {
  const result:THREE.Mesh[]=[];
  const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
  for(const part of source.children){
    if(!(part instanceof THREE.Mesh)||Array.isArray(part.material))throw new TypeError('Ship parts must have one shared material');
    if(moving.has(part.name)){
      result.push(part.clone());
      continue;
    }
    part.updateMatrix();
    const geo=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();
    geo.applyMatrix4(part.matrix);
    // Match attributes for primitive and authored lofts; no texture coordinates
    // are used by the fleet, so retaining UVs would just waste vertex bandwidth.
    for(const key of Object.keys(geo.attributes))if(key!=='position'&&key!=='normal'&&key!=='color')geo.deleteAttribute(key);
    const bucket=buckets.get(part.material)??[];
    bucket.push(geo);buckets.set(part.material,bucket);
  }
  for(const [material,geometries] of buckets){
    const merged=mergeGeometries(geometries);
    geometries.forEach(g=>g.dispose());
    if(!merged)throw new Error('Ship geometry merge failed');
    resources.push(merged);
    const mesh=new THREE.Mesh(merged,material);
    mesh.name=source.name+'-rigid-'+material.uuid;
    result.push(mesh);
  }
  for(const mesh of result){mesh.castShadow=true;mesh.receiveShadow=true;}
  return result;
}
