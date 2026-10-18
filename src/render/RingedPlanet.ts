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
    const geo=new THREE.SphereGeometry(1,40,28).toNonIndexed();
    const p=geo.getAttribute('position');
    const colors=new Float32Array(p.count*3);
    const belt=[0x4a567d,0x777daa,0x9294b4,0x676a9d,0xa49aaf,0x66668e];
    const temp=new THREE.Color();
    for(let i=0;i<p.count;i++){
      const y=p.getY(i),x=p.getX(i),z=p.getZ(i);
      const phi=Math.atan2(z,x);
      // Each latitude wanders slightly with longitude; broad strips + thin weather bands.
      const latitude=y+.037*Math.sin(phi*3+y*11)+.014*Math.sin(phi*7-y*19);
      const band=Math.min(belt.length-1,Math.max(0,Math.floor((latitude+1)*belt.length/2)));
      const turbulence=.96+.035*Math.sin(phi*9+latitude*42);
      const thin=.93+.06*Math.sin(latitude*87+phi*2);
      temp.setHex(belt[band]).multiplyScalar(turbulence*thin);
      temp.toArray(colors,i*3);
    }
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const bodyMaterial=new THREE.MeshStandardMaterial({
      vertexColors:true,roughness:.86,metalness:.04,
      emissive:0x22264a,emissiveIntensity:.15,depthTest:true,depthWrite:true,
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
      const angle=Math.atan2(v.getY(i),v.getX(i));
      const phase=(radius-1.34)/.79;
      const lane=.58+.21*Math.sin(phase*40)+.12*Math.cos(phase*107);
      const split=phase>.35&&phase<.41?.34:phase>.72&&phase<.77?.43:1;
      const col=new THREE.Color().setHSL(.64+.035*Math.sin(phase*7+angle*.4),.20,
        (.29+.24*phase)*lane*split+.10);
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
      color:0x9399c0,roughness:.94,side:THREE.DoubleSide,
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
    const narrowLandscape=width<1000&&height<500&&width/height>1.1;
    const radius=Math.min(portrait?1.16:1.50,layout.spanY*(portrait?.030:.058));
    this.group.scale.setScalar(radius);
    // Entire planet (including rings) stays outside the principal shooting corridor.
    const edgeX=narrowLandscape?-layout.spanX*.33:layout.spanX*.39;
    this.group.position.set(edgeX,layout.centerY+layout.spanY*.23,-18);
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
