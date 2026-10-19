import * as THREE from 'three';
import type {CombatProjection} from './CombatProjection.ts';

/**
 * P4/B2: an actual rotatable three-dimensional small Saturn-like planet.
 * Latitude strips are computed on the globe mesh; rings are separate real annuli.
 * Globe depth buffer occludes the far halves of the tilted rings.
 */
export class RingedPlanet {
  readonly group=new THREE.Group();
  readonly sphere:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
  readonly ring:THREE.Mesh<THREE.RingGeometry,THREE.MeshStandardMaterial>;
  readonly outerRing:THREE.Mesh<THREE.RingGeometry,THREE.MeshStandardMaterial>;
  private readonly owned:Array<THREE.BufferGeometry|THREE.Material>=[];
  private readonly debugSide:boolean;

  constructor(parent:THREE.Group,inspectSide=false){
    this.debugSide=inspectSide;
    this.group.name='p4-sculpted-ringed-planet';
    const geo=new THREE.SphereGeometry(1,28,18).toNonIndexed();
    const p=geo.getAttribute('position');
    const colors=new Float32Array(p.count*3);
    const belt=[0x89acbd,0xa6c2cc,0xc6c6db,0xaaa0cc,0x95b9c8];
    const temp=new THREE.Color();
    for(let i=0;i<p.count;i++){
      const y=p.getY(i),x=p.getX(i),z=p.getZ(i);
      const phi=Math.atan2(z,x);
      // Broad pastel bands and clean lit facets, not a noisy photographic surface.
      const latitude=y+.025*Math.sin(phi*2);
      const band=Math.min(belt.length-1,Math.max(0,Math.floor((latitude+1)*belt.length/2)));
      temp.setHex(belt[band]);
      temp.toArray(colors,i*3);
    }
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const bodyMaterial=new THREE.MeshStandardMaterial({
      vertexColors:true,flatShading:true,roughness:.80,metalness:.02,envMapIntensity:.12,
      emissive:0x243d52,emissiveIntensity:.09,depthTest:true,depthWrite:true,
    });
    this.sphere=new THREE.Mesh(geo,bodyMaterial);
    this.sphere.name='p4-actual-banded-spherical-globe';
    this.group.add(this.sphere);
    this.owned.push(geo,bodyMaterial);

    const annulus=new THREE.RingGeometry(1.34,2.13,96,20);
    const v=annulus.getAttribute('position');
    const tints=new Float32Array(v.count*3);
    for(let i=0;i<v.count;i++){
      const radius=Math.hypot(v.getX(i),v.getY(i));
      const phase=(radius-1.34)/.79;
      const col=new THREE.Color(phase<.34?0x90adbc:phase<.43?0x354b67:phase<.82?0xb8b5c9:0x819eae);
      col.toArray(tints,i*3);
    }
    annulus.setAttribute('color',new THREE.BufferAttribute(tints,3));
    const ringMaterial=new THREE.MeshStandardMaterial({
      vertexColors:true,roughness:.94,metalness:.02,side:THREE.DoubleSide,
      transparent:true,opacity:.75,depthTest:true,depthWrite:false,
    });
    this.ring=new THREE.Mesh(annulus,ringMaterial);
    this.ring.name='p4-multi-strata-thick-tilted-annulus';
    this.ring.rotation.set(1.06,.16,-.23);
    this.group.add(this.ring);
    this.owned.push(annulus,ringMaterial);

    const fringe=new THREE.RingGeometry(2.16,2.29,96,3);
    const fringeMaterial=new THREE.MeshStandardMaterial({
      color:0xb7d8db,roughness:.94,side:THREE.DoubleSide,
      transparent:true,opacity:.28,depthTest:true,depthWrite:false,
    });
    this.outerRing=new THREE.Mesh(fringe,fringeMaterial);
    this.outerRing.name='p4-faint-separated-outer-ring';
    this.outerRing.rotation.copy(this.ring.rotation);
    this.group.add(this.outerRing);
    this.owned.push(fringe,fringeMaterial);

    this.group.position.z=-18;
    this.group.rotation.set(.07,.1,-.17);
    parent.add(this.group);
  }
  /** Theme changes colors in place; no new GPU texture, geometry or material. */
  setTint(tint:number):void{
    for(const mat of [this.sphere.material,this.ring.material,this.outerRing.material])
      mat.color.setHex(tint);
  }
  resize(layout:CombatProjection,width:number,height:number):void{
    const portrait=width/height<.9;
    const radius=Math.min(portrait?1.16:1.50,layout.spanY*(portrait?.030:.058));
    this.group.scale.setScalar(radius);
    // Entire planet (including rings) stays outside the principal shooting corridor.
    this.group.position.set(layout.spanX*.39,layout.centerY+layout.spanY*.23,-18);
  }
  update(tick:number,reducedMotion=false):void{
    this.sphere.rotation.y=reducedMotion?0:tick*.0003;
    this.group.rotation.y=this.debugSide?.9:.13+(!reducedMotion?tick*.00008:0);
  }
  get meshes():number{return 3;}
  dispose():void{
    this.group.remove(this.sphere,this.ring,this.outerRing);
    this.group.parent?.remove(this.group);
    this.owned.forEach(item=>item.dispose());
  }
}
