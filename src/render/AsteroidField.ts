import * as THREE from 'three';
import type { CombatProjection } from './CombatProjection.ts';

function jitter(seed:number,x:number,y:number,z:number):number{
  const n=Math.sin(x*37.31+y*91.17+z*53.09+seed*161.5)*43758.5453;
  return n-Math.floor(n);
}
/** Four original printable/editable low-polygon meshes, deterministic shape and reusable as foreground. */
export function createAsteroidGeometry(seed:number):THREE.BufferGeometry{
  const geometry=new THREE.IcosahedronGeometry(1,1);
  const p=geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const radius=.79+jitter(seed,Math.round(x*100)/100,Math.round(y*100)/100,Math.round(z*100)/100)*.35;
    p.setXYZ(i,x*radius,y*radius,z*radius);
  }
  p.needsUpdate=true;
  geometry.computeVertexNormals();
  return geometry;
}

interface Rock { readonly instance:THREE.InstancedMesh;readonly kind:number;readonly count:number }
/** No game logic, no meshes per asteroid. Stable positions and 4 batched draw calls. */
export class AsteroidField{
  private readonly layer: THREE.Group;
  private readonly rocks:Rock[]=[];
  private readonly resources:Array<THREE.BufferGeometry|THREE.Material>=[];
  private readonly matrix=new THREE.Matrix4();
  private readonly pose=new THREE.Quaternion();
  private readonly scale=new THREE.Vector3();
  private readonly translation=new THREE.Vector3();
  private readonly euler=new THREE.Euler();
  private viewWidth=36;private viewHeight=24;private centerY=0;
  private isPortrait=false;
  readonly totalCount=12;
  constructor(layer:THREE.Group){
    this.layer=layer;
    const colors=[0x3d4c6a,0x46516f,0x545875,0x354862];
    const materials=colors.map(hex=>new THREE.MeshStandardMaterial({
      color:hex,flatShading:true,roughness:.93,metalness:.01,
      emissive:0x11172c,emissiveIntensity:.12,depthTest:true,depthWrite:true,
    }));
    this.resources.push(...materials);
    for(let kind=0;kind<4;kind++){
      const geometry=createAsteroidGeometry(17+kind*7);
      this.resources.push(geometry);
      const batch=new THREE.InstancedMesh(geometry,materials[kind],3);
      batch.name='p3-distant-rock-'+kind;
      batch.count=3;
      batch.frustumCulled=false;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      layer.add(batch);
      this.rocks.push({instance:batch,kind,count:3});
    }
    this.update(0,false);
  }
  resize(layout:CombatProjection,width:number,height:number):void{
    this.viewWidth=layout.spanX;
    this.viewHeight=layout.spanY;
    this.centerY=layout.centerY;
    this.isPortrait=width/height<.83;
    this.update(0,false);
  }
  update(tick:number,reducedMotion=false):void{
    const elapsed=(reducedMotion?0:tick)/60;
    for(const item of this.rocks){
      item.instance.visible=!this.isPortrait;
      for(let i=0;i<item.count;i++){
        const index=item.kind*3+i;
        const side=index%2===0?-1:1;
        const ring=index%3;
        const u=side*(.33+.055*(ring%2));
        const v=[-.31,.16,.33][ring];
        const phase=index*1.487;
        const driftX=Math.sin(elapsed*.13+phase)*.13;
        const driftY=Math.cos(elapsed*.17+phase)*.12;
        const z=-8-(index%4)*1.8;
        const size=(.47+(index%5)*.09)*(this.isPortrait ? .60 : 1);
        this.translation.set(u*this.viewWidth+driftX,v*this.viewHeight+this.centerY+driftY,z);
        this.euler.set(index*.57+elapsed*.06,index*.31+elapsed*.045,index*.13+elapsed*.03);
        this.pose.setFromEuler(this.euler);
        this.scale.setScalar(size);
        this.matrix.compose(this.translation,this.pose,this.scale);
        item.instance.setMatrixAt(i,this.matrix);
      }
      item.instance.instanceMatrix.needsUpdate=true;
    }
  }
  setTint(tint:number):void{
    for(const rock of this.rocks){
      (rock.instance.material as THREE.MeshStandardMaterial).color
        .setHex([0x3d4c6a,0x46516f,0x545875,0x354862][rock.kind])
        .multiply(new THREE.Color(tint));
    }
  }
  get batches():number{return this.rocks.length;}
  get visibleCount():number{return this.isPortrait?0:this.totalCount;}
  dispose():void{
    for(const item of this.rocks){this.layer.remove(item.instance);item.instance.dispose();}
    this.resources.forEach(resource=>resource.dispose());
    this.rocks.length=0;this.resources.length=0;
  }
}
