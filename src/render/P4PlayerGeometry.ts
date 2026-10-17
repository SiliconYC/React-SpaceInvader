import * as THREE from 'three';

/** Editable original P4 surface geometry. All stations are in the visual XY plane; Z is purely volume. */
export interface HullStation {
  readonly y: number; readonly radiusX: number;
  readonly centerZ: number; readonly radiusZ: number;
}
export interface WingStation {
  readonly x: number; readonly leadingY: number; readonly trailingY: number;
  readonly z: number; readonly thickness: number;
}

/** Continuous closed elliptical stations: sculpted fuselage or nacelle, not stacked primitive boxes. */
export function createHullLoft(stations: readonly HullStation[], sides=16): THREE.BufferGeometry {
  if (stations.length<3||sides<6) throw new RangeError('至少三段机身截面');
  const vertices:number[]=[],indices:number[]=[];
  for(const station of stations){
    for(let k=0;k<sides;k++){
      const a=k*2*Math.PI/sides;
      vertices.push(station.radiusX*Math.cos(a),station.y,
        station.centerZ+station.radiusZ*Math.sin(a));
    }
  }
  for(let j=0;j<stations.length-1;j++)for(let k=0;k<sides;k++){
    const a=j*sides+k,b=j*sides+(k+1)%sides,c=(j+1)*sides+k,d=(j+1)*sides+(k+1)%sides;
    indices.push(a,c,b,b,c,d);
  }
  for(const end of [0,stations.length-1]){
    const s=stations[end],c=vertices.length/3;
    vertices.push(0,s.y,s.centerZ);
    for(let k=0;k<sides;k++){
      const a=end*sides+k,b=end*sides+(k+1)%sides;
      if(end===0)indices.push(c,a,b);else indices.push(c,b,a);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Six-edge chamfered wing sections; both faces have actual volume and smooth tip taper. */
export function createWingAirfoil(stations: readonly WingStation[], side:-1|1): THREE.BufferGeometry {
  if(stations.length<2)throw new RangeError('翼型至少需要两个展向截面');
  const v:number[]=[],indices:number[]=[];
  for(const s of stations){
    const x=s.x*side, chord=s.leadingY-s.trailingY;
    const bevel=Math.min(.055,chord*.19);
    const h=s.thickness*.5;
    v.push(
      x,s.leadingY,s.z,
      x,s.leadingY-bevel,s.z+h,
      x,s.trailingY+bevel,s.z+h,
      x,s.trailingY,s.z,
      x,s.trailingY+bevel,s.z-h,
      x,s.leadingY-bevel,s.z-h,
    );
  }
  for(let j=0;j<stations.length-1;j++)for(let k=0;k<6;k++){
    const a=j*6+k,b=j*6+(k+1)%6,c=(j+1)*6+k,d=(j+1)*6+(k+1)%6;
    if(side===1)indices.push(a,c,b,b,c,d);
    else indices.push(a,b,c,b,d,c);
  }
  for(const end of [0,stations.length-1]){
    const start=end*6;
    for(let i=1;i<5;i++){
      if((end===0)===(side===1))indices.push(start,start+i,start+i+1);
      else indices.push(start,start+i+1,start+i);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
