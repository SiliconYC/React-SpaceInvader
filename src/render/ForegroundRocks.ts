import * as THREE from 'three';
import type { World2 } from '../core/world.ts';
import type { CombatProjection } from './CombatProjection.ts';
import type { ScreenRect, CombatSceneLayers } from './CombatSceneLayers.ts';
import { createAsteroidGeometry } from './AsteroidField.ts';

interface Rock {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  readonly side: -1 | 1;
  readonly screenY: number;
  readonly phase: number;
  readonly tint:number;
  baseX: number;
  baseY: number;
}

/**
 * Reuses the genuine #44 icosahedron generator for four close-looking edge silhouettes.
 * Every candidate must pass #36's screen-space gate, including after a rotating frame.
 * This is pure presentation; no hitbox, world coordinate or collision is ever modified.
 */
export class ForegroundRocks {
  private readonly world: Readonly<World2>;
  private readonly rocks: Rock[] = [];
  private readonly layers: CombatSceneLayers;
  private readonly projected = new THREE.Vector3();
  readonly count = 2;

  constructor(layers: CombatSceneLayers, world: Readonly<World2>) {
    this.layers = layers;
    this.world = world;
    // Two art-directed side silhouettes, rather than four decorative clutter blocks.
    const configuration: Array<{side:-1|1; y:number; seed:number; tint:number; phase:number}> = [
      {side:-1,y:.37,seed:18,tint:0x596b87,phase:.52},
      {side:1,y:.63,seed:24,tint:0x4b5f7b,phase:3.17},
    ];
    for (const entry of configuration) {
      const geometry = createAsteroidGeometry(entry.seed);
      geometry.computeBoundingSphere();
      const material = new THREE.MeshStandardMaterial({
        color:entry.tint,vertexColors:true,flatShading:true,roughness:.94,metalness:.025,
        emissive:0x12182a,emissiveIntensity:.1,
      });
      const mesh = new THREE.Mesh(geometry,material);
      mesh.name = 'p3-safe-edge-rock-' + entry.seed;
      mesh.position.z = 3;
      const rock:Rock = {
        mesh,geometry,material,side:entry.side,screenY:entry.y,
        phase:entry.phase,tint:entry.tint,baseX:0,baseY:0,
      };
      this.rocks.push(rock);
      // Gate clones draw material (depthTest/depthWrite off) and fails closed until refresh.
      layers.addForeground(mesh,(camera,width,height)=>this.screenBounds(rock,camera,width,height));
    }
  }

  resize(layout: CombatProjection,camera: THREE.Camera,width:number,height:number):void {
    const px=height/layout.spanY;
    // Exact same 1.5-world-unit tolerance as the #36 projection contract.
    const margin=Math.max(28,px*1.5);
    const freeBand=Math.max(0,(width-this.world.width*px)/2-margin-5);
    const viable=width>=740&&height>=500&&width/height>=1.1&&freeBand>22;
    const radiusPixels=viable?Math.min(54,freeBand*.31):0;
    const z=3;
    const factor=camera instanceof THREE.PerspectiveCamera
      ? (layout.cameraDistance-z)/layout.cameraDistance : 1;
    const edgeCenter=Math.max(radiusPixels+4,freeBand*.50);
    for(const rock of this.rocks){
      const boundingRadius=rock.geometry.boundingSphere?.radius ?? 1.2;
      const radiusWorld=radiusPixels/px*factor;
      rock.mesh.scale.setScalar(viable?radiusWorld/boundingRadius:0.00001);
      const x=rock.side===-1?edgeCenter:width-edgeCenter;
      rock.baseX=(x-width/2)/px*factor;
      rock.baseY=layout.centerY+(height/2-height*rock.screenY)/px*factor;
    }
    this.update(0,true);
  }

  update(tick:number,reducedMotion=false):void {
    const t=reducedMotion?0:tick/60;
    for(const rock of this.rocks){
      // Subpixel-paced drift and true 3-axis geometry rotation, deterministic across pause.
      rock.mesh.position.set(
        rock.baseX+Math.sin(t*(.083+.018*rock.phase)+rock.phase)*.032,
        rock.baseY+Math.cos(t*(.097+.013*rock.phase)+rock.phase*1.3)*.028,3);
      rock.mesh.rotation.set(
        .23+Math.sin(t*.047+rock.phase)*.09,
        rock.phase*.19+t*(.022+.003*rock.phase),
        Math.cos(t*.035+rock.phase)*.075);
    }
  }

  /** Conservative bounds of a world-space cube enclosing the whole rotated stone. */
  private screenBounds(rock:Rock,camera:THREE.Camera,width:number,height:number):ScreenRect {
    const center=rock.mesh.position;
    const radius=(rock.geometry.boundingSphere?.radius ?? 1.2)*rock.mesh.scale.x;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(let i=0;i<8;i++){
      this.projected.set(
        center.x+(i&1?radius:-radius),
        center.y+(i&2?radius:-radius),
        center.z+(i&4?radius:-radius),
      ).project(camera);
      const x=(this.projected.x+1)*width/2;
      const y=(1-this.projected.y)*height/2;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    return {left:minX-3,top:minY-3,right:maxX+3,bottom:maxY+3};
  }

  setTint(tint:number):void{
    const color=new THREE.Color(tint);
    for(const rock of this.rocks){
      const mat=rock.mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(rock.tint).multiply(color);
    }
  }
  get visibleCount():number {return this.layers.visibleForegroundCount;}
  dispose():void {
    for(const rock of this.rocks){
      rock.mesh.parent?.remove(rock.mesh);
      rock.geometry.dispose();
      rock.material.dispose();
    }
    this.rocks.length=0;
  }
}
