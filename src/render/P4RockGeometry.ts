import * as THREE from 'three';
import type {CombatProjection} from './CombatProjection.ts';

/** P4/B3: deliberately authored rock volumes, NOT randomly jittered icosahedra.
 * Distinct silhouettes: broad basalt, needle shard, chiseled wedge, compact iron,
 * stratified slate. Shared buffer geometry and vertex facets, no textures/allocations per instance.
 */
interface RockProfile {
  radii:readonly number[];
  readonly width:number;readonly height:number;readonly thickness:number;
  readonly lean:number;readonly shoulder:number;
}
export const ROCK_PROFILES:readonly RockProfile[]=[
  {radii:[.85,1.06,.91,1.14,.89,.76,1.05,.86],width:1.03,height:.82,thickness:.74,lean:.08,shoulder:.16},
  {radii:[.73,.88,.67,1.18,.73,1.02,.86],width:.56,height:1.43,thickness:.52,lean:.20,shoulder:-.15},
  {radii:[1.13,.74,1.05,.88,.69,1.19],width:1.17,height:.66,thickness:.59,lean:-.21,shoulder:.16},
  {radii:[.95,.84,1.05,.93,.82,1.08,1.02,.88,.91],width:.84,height:.96,thickness:1.04,lean:.06,shoulder:.11},
  {radii:[.95,1.12,.84,.67,.97,.87,.72,.91],width:1.23,height:.53,thickness:.46,lean:-.10,shoulder:.12},
];

/** Editable triangulated polyhedral sculpture; each face has independent normals and color. */
export function createAsteroidGeometry(seed:number):THREE.BufferGeometry{
  const profile=ROCK_PROFILES[Math.abs(Math.floor(seed))%ROCK_PROFILES.length];
  const n=profile.radii.length;
  const verts:number[]=[];
  const layers=[
    {z:-profile.thickness*.64,mul:.62,dx:-profile.lean*.36,dy:-profile.shoulder*.45},
    {z:-profile.thickness*.12,mul:1,dx:0,dy:0},
    {z: profile.thickness*.61,mul:.73,dx:profile.lean,dy:profile.shoulder},
  ];
  for(const layer of layers)for(let i=0;i<n;i++){
    const a=2*Math.PI*i/n+.13;
    const r=profile.radii[i]*layer.mul;
    verts.push(cos(a)*r*profile.width+layer.dx,
               sin(a)*r*profile.height+layer.dy,layer.z);
  }
  const bottom=verts.length/3;verts.push(0,0,layers[0].z);
  const top=verts.length/3;verts.push(profile.lean,profile.shoulder,layers[2].z);
  const faces:number[]=[];
  for(let j=0;j<2;j++)for(let i=0;i<n;i++){
    const k=(i+1)%n,a=j*n+i,b=j*n+k,c=(j+1)*n+i,d=(j+1)*n+k;
    faces.push(a,b,c,b,d,c);
  }
  for(let i=0;i<n;i++){
    const k=(i+1)%n;
    faces.push(bottom,k,i);
    faces.push(top,2*n+i,2*n+k);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setIndex(faces);
  const faceted=geo.toNonIndexed();
  geo.dispose();
  faceted.computeVertexNormals();
  const pos=faceted.getAttribute('position');
  const normals=faceted.getAttribute('normal');
  const colors=new Float32Array(pos.count*3);
  for(let t=0;t<pos.count;t+=3){
    const nZ=normals.getZ(t),nY=normals.getY(t);
    // The same paint color on every face, lit by controlled planar mineral variation.
    const facet=Math.max(.56,Math.min(1.04,.77+.14*nZ+.08*nY
      +.035*Math.sin(t*.73+seed*.1)));
    for(let v=0;v<3;v++)for(let c=0;c<3;c++)colors[(t+v)*3+c]=
      facet*([.81,.89,1.0][c]);
  }
  faceted.setAttribute('color',new THREE.BufferAttribute(colors,3));
  faceted.computeBoundingSphere();
  return faceted;
}
function cos(a:number):number{return Math.cos(a);}
function sin(a:number):number{return Math.sin(a);}

interface RockBatch {readonly instance:THREE.InstancedMesh;readonly kind:number}
const BASE_TINTS=[0x546581,0x465975,0x607088,0x45546d,0x56637b] as const;

/** Ten sparse environmental stones / five GPU batches; portrait hides all. */
export class AsteroidField{
  private readonly layer:THREE.Group;
  private readonly rocks:RockBatch[]=[];
  private readonly resources:Array<THREE.BufferGeometry|THREE.Material>=[];
  private readonly matrix=new THREE.Matrix4();
  private readonly pose=new THREE.Quaternion();
  private readonly scale=new THREE.Vector3();
  private readonly translation=new THREE.Vector3();
  private readonly euler=new THREE.Euler();
  private viewWidth=36;private viewHeight=24;private centerY=0;
  private isPortrait=false;private isCompact=false;
  readonly totalCount=10;
  constructor(layer:THREE.Group){
    this.layer=layer;
    for(let kind=0;kind<ROCK_PROFILES.length;kind++){
      const geometry=createAsteroidGeometry(kind);
      const material=new THREE.MeshStandardMaterial({
        color:BASE_TINTS[kind],vertexColors:true,flatShading:true,
        roughness:.93,metalness:.025,emissive:0x141a30,emissiveIntensity:.08,
        depthTest:true,depthWrite:true,
      });
      this.resources.push(geometry,material);
      const instances=new THREE.InstancedMesh(geometry,material,2);
      instances.name='p4-sculpted-environment-rock-'+kind;
      instances.count=2;instances.frustumCulled=false;
      instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      layer.add(instances);
      this.rocks.push({instance:instances,kind});
    }
    this.update(0,true);
  }
  resize(layout:CombatProjection,width:number,height:number):void{
    this.viewWidth=layout.spanX;
    this.viewHeight=layout.spanY;
    this.centerY=layout.centerY;
    this.isPortrait=width/height<.90;
    this.isCompact=width<1050||height<620;
    this.update(0,false);
  }
  update(tick:number,reducedMotion=false):void{
    const t=(reducedMotion?0:tick)/60;
    for(const rock of this.rocks){
      const mesh=rock.instance;
      mesh.count=this.isPortrait?0:this.isCompact?1:2;
      mesh.visible=mesh.count>0;
      for(let i=0;i<mesh.count;i++){
        const n=rock.kind*2+i;
        const side=n%2===0?-1:1;
        const phase=1.21*n+rock.kind*.19;
        const depth=n%3;
        // Only outside the main shoot corridor; deep stones fade by lighting and scale.
        const x=side*(.345+.035*(n%3))*this.viewWidth
          +.16*Math.sin(t*(.067+.012*depth)+phase);
        const y=this.centerY+[.29,-.25,.11][n%3]*this.viewHeight
          +.13*Math.sin(t*(.083+.014*depth)+phase*1.33);
        const z=-9-2.1*depth;
        const sz=(.48+.10*(rock.kind%3))*(1-.12*depth);
        this.translation.set(x,y,z);
        this.euler.set(phase*.32+t*(.029+.011*rock.kind),
          phase*.19+t*(.043+.009*depth),phase*.23+t*(.019+.007*n));
        this.pose.setFromEuler(this.euler);
        this.scale.setScalar(sz);
        this.matrix.compose(this.translation,this.pose,this.scale);
        mesh.setMatrixAt(i,this.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    }
  }
  setTint(tint:number):void{
    const modifier=new THREE.Color(tint);
    this.rocks.forEach(({instance,kind})=>
      (instance.material as THREE.MeshStandardMaterial).color.setHex(BASE_TINTS[kind]).multiply(modifier));
  }
  get batches():number{return this.rocks.length;}
  get visibleCount():number{return this.isPortrait?0:this.isCompact?5:this.totalCount;}
  dispose():void{
    for(const {instance} of this.rocks){this.layer.remove(instance);instance.dispose();}
    this.resources.forEach(item=>item.dispose());
    this.rocks.length=0;this.resources.length=0;
  }
}
