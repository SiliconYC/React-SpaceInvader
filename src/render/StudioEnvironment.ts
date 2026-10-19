import * as THREE from 'three';

/** Pre-filtered, original Three.js RoomEnvironment, baked offline by
 * scripts/bake-studio-environment.mjs. CPU image survives WebGL context loss.
 * CubeUV mapping is essential: equirect mapping would trigger runtime PMREM. */
export class StudioEnvironment {
  readonly texture:THREE.Texture;
  static readonly intensity=.18*64; // atlas linear RGB is range-scaled by 64
  private disposed=false;
  constructor(host:HTMLDivElement){
    const placeholder=document.createElement('canvas');
    placeholder.width=768;placeholder.height=1024;
    this.texture=new THREE.Texture(placeholder);
    this.texture.mapping=THREE.CubeUVReflectionMapping;
    this.texture.colorSpace=THREE.SRGBColorSpace;
    this.texture.flipY=false;
    this.texture.generateMipmaps=false;
    this.texture.minFilter=THREE.LinearFilter;
    this.texture.magFilter=THREE.LinearFilter;
    this.texture.needsUpdate=true;
    host.dataset.studioEnvironment='loading';
    new THREE.TextureLoader().load(import.meta.env.BASE_URL+'art/studio-cubeuv.png',loaded=>{
      if(!this.disposed){
        this.texture.image=loaded.image;
        this.texture.needsUpdate=true;
        host.dataset.studioEnvironment='loaded';
      }
      loaded.dispose();
    },undefined,()=>{if(!this.disposed)host.dataset.studioEnvironment='fallback';});
  }
  dispose():void{this.disposed=true;this.texture.dispose();}
}
