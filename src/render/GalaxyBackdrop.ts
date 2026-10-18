import * as THREE from 'three';
import type { CombatProjection } from './CombatProjection.ts';

/** Real Git-tracked image behind all combat meshes. Failed requests leave the solid-color fallback. */
export class GalaxyBackdrop {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private texture: THREE.Texture | null = null;
  private disposed = false;
  private width = 1;
  private height = 1;
  private readonly sourceAspect = 1600 / 900;
  private state: 'loading'|'loaded'|'fallback' = 'loading';
  static readonly path = 'art/backgrounds/galaxy-p4-veil.webp';
  static readonly alternatePath = 'art/backgrounds/galaxy-p4-arc.webp';
  static readonly legacyPath = 'art/backgrounds/galaxy-v2.webp';
  constructor(private readonly parent: THREE.Group, private readonly host: HTMLDivElement,
    private readonly tint:number=0xffffff,private readonly curatedPath:string=GalaxyBackdrop.path) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x07152b, depthTest: false, depthWrite: false,
      toneMapped: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'p3-galaxy-bitmap-layer';
    this.mesh.position.z = -35;
    this.mesh.renderOrder = -100;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    host.dataset.galaxy = 'loading';
    // Reproducible real-game comparison: ?galaxy=veil|arc|legacy; no external runtime requests.
    const choice=new URLSearchParams(window.location.search).get('galaxy');
    const selected=choice==='arc' ? GalaxyBackdrop.alternatePath :
      choice==='legacy' ? GalaxyBackdrop.legacyPath :
      choice==='veil' ? GalaxyBackdrop.path : this.curatedPath;
    host.dataset.galaxyVariant=choice==='arc'?'arc':choice==='legacy'?'legacy':choice==='veil'?'veil':'theme';
    host.dataset.galaxyUrl = import.meta.env.BASE_URL + selected;
    new THREE.TextureLoader().load(
      host.dataset.galaxyUrl,
      texture => {
        if (this.disposed) {texture.dispose();return;}
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        this.texture=texture;
        material.map=texture;
        material.color.setHex(this.tint);
        material.needsUpdate=true;
        this.state='loaded';
        this.updateCrop();
        host.dataset.galaxy=this.state;
      },
      undefined,
      () => {if(!this.disposed){this.state='fallback';host.dataset.galaxy=this.state;}},
    );
  }

  /** World-aligned full-cover image plane. Every XY pixel stays on the original focal plane. */
  resize(layout: CombatProjection, camera: THREE.Camera, width: number, height: number): void {
    this.width=width;this.height=height;
    const perspective = camera instanceof THREE.PerspectiveCamera;
    const scale = perspective ? (layout.cameraDistance+35)/layout.cameraDistance : 1;
    this.mesh.scale.set(layout.spanX*scale*1.002, layout.spanY*scale*1.002,1);
    this.mesh.position.set(0,layout.centerY,-35);
    this.updateCrop();
  }
  private updateCrop():void {
    const texture=this.texture;
    if(!texture || this.height<=0)return;
    const aspect=this.width/this.height;
    if(aspect>this.sourceAspect) {
      texture.repeat.set(1,this.sourceAspect/aspect);
      texture.offset.set(0,(1-texture.repeat.y)/2);
    }else{
      texture.repeat.set(aspect/this.sourceAspect,1);
      texture.offset.set((1-texture.repeat.x)/2,0);
    }
    texture.needsUpdate=true;
  }
  get status():string{return this.state;}
  dispose():void{
    this.disposed=true;
    this.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.texture?.dispose();
    this.texture=null;
  }
}
