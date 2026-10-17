import * as THREE from 'three';
import type {CombatProjection} from './CombatProjection.ts';

const SHADE=[0x48518d,0x6c6fa8,0x8e88bb,0x5f659e];
/** Original shader-free dimensional planet: independent opaque globe and tilted annular mesh. */
export class RingedPlanet {
  readonly group=new THREE.Group();
  readonly sphere:THREE.Mesh;
  readonly ring:THREE.Mesh;
  private readonly owned: Array<THREE.BufferGeometry|THREE.Material>=[];
  private readonly debugSide:boolean;
  constructor(parent:THREE.Group,inspectSide=false){
    this.debugSide=inspectSide;
    this.group.name='p3-ringed-saturn';
    const geo=new THREE.SphereGeometry(1,24,12).toNonIndexed();
    const positions=geo.getAttribute('position');
    const colors=new Float32Array(positions.count*3);
    const temp=new THREE.Color();
    for(let i=0;i<positions.count;i+=3){
      const latitude=(positions.getY(i)+positions.getY(i+1)+positions.getY(i+2))/3;
      const lane=Math.min(3,Math.max(0,Math.floor((latitude+1)*2)));
      temp.setHex(SHADE[lane]);
      const modulation=.93+.06*Math.sin(i*1.319);
      for(let j=0;j<3;j++)for(let k=0;k<3;k++)colors[(i+j)*3+k]=[temp.r,temp.g,temp.b][k]*modulation;
    }
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const bodyMaterial=new THREE.MeshStandardMaterial({
      vertexColors:true,flatShading:true,roughness:.85,metalness:.04,
      emissive:0x1a2049,emissiveIntensity:.16,depthTest:true,depthWrite:true,
    });
    this.sphere=new THREE.Mesh(geo,bodyMaterial);
    this.sphere.name='actual-low-poly-sphere';
    this.group.add(this.sphere);
    const annulus=new THREE.RingGeometry(1.38,2.13,64,6);
    const v=annulus.getAttribute('position');
    const rcolors=new Float32Array(v.count*3);
    for(let i=0;i<v.count;i++){
      const rr=Math.hypot(v.getX(i),v.getY(i));
      const mix=(rr-1.38)/.75;
      const color=new THREE.Color().setHSL(.68-.06*mix,.21,.33+.23*Math.sin(mix*Math.PI));
      color.toArray(rcolors,i*3);
    }
    annulus.setAttribute('color',new THREE.BufferAttribute(rcolors,3));
    const bandMaterial=new THREE.MeshStandardMaterial({
      vertexColors:true,roughness:.9,side:THREE.DoubleSide,
      transparent:true,opacity:.7,depthTest:true,depthWrite:false,
    });
    this.ring=new THREE.Mesh(annulus,bandMaterial);
    this.ring.name='actual-tilted-3d-ring';
    this.ring.rotation.set(.47,.12,-.15);
    this.group.add(this.ring);
    this.group.position.z=-18;
    this.group.rotation.set(.07,.1,-.17);
    parent.add(this.group);
    this.owned.push(geo,bodyMaterial,annulus,bandMaterial);
  }
  resize(layout:CombatProjection,width:number,height:number):void{
    const portrait=width/height<.9;
    const radius=Math.min(portrait?1.65:2.8,layout.spanY*(portrait ? .065 : .105));
    this.group.scale.setScalar(radius);
    // Decorative sphere is behind gameplay in true depth, and deliberately displaced to the upper-right.
    this.group.position.set(layout.spanX*.43,layout.centerY+layout.spanY*.32,-18);
  }
  update(tick:number,reducedMotion=false):void{
    this.sphere.rotation.y=reducedMotion?0:tick*.0003;
    this.group.rotation.y=this.debugSide?.9:.13+(!reducedMotion?tick*.00008:0);
  }
  get meshes():number{return 2;}
  dispose():void{
    this.group.remove(this.sphere,this.ring);
    this.group.parent?.remove(this.group);
    this.owned.forEach(item=>item.dispose());
  }
}
