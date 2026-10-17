import * as THREE from 'three';
import type { World2 } from '../core/world.ts';
import { combatProjection, projectBattlePoint } from './CombatProjection.ts';

export type SceneLayerName = 'starfield' | 'celestial' | 'environment' | 'combat' | 'foreground';
export const SCENE_LAYER_ORDER: readonly SceneLayerName[] =
  ['starfield', 'celestial', 'environment', 'combat', 'foreground'] as const;
export interface ScreenRect {
  readonly left: number; readonly top: number;
  readonly right: number; readonly bottom: number;
}
export function rectanglesOverlap(a: ScreenRect, b: ScreenRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
/** Any invalid, mobile-portrait or overlapping decoration is discarded, never clipped over bullets. */
export function isSafeEdgeDecoration(rect: ScreenRect, world: World2, width: number,
  height: number, coarse: boolean): boolean {
  if (width < 740 || height < 500 || width / height < 1.1) return false;
  if (![rect.left,rect.top,rect.right,rect.bottom].every(Number.isFinite) ||
      rect.left >= rect.right || rect.top >= rect.bottom ||
      rect.left < 0 || rect.top < 0 || rect.right > width || rect.bottom > height) return false;
  const layout = combatProjection(world, width, height, coarse);
  const topLeft = projectBattlePoint({x:0,y:world.height},world,layout,width,height);
  const bottomRight = projectBattlePoint({x:world.width,y:0},world,layout,width,height);
  // Include ship thickness, edge bullets, projectile glow and collision/animation tolerances.
  const margin = Math.max(28, height / layout.spanY * 1.5);
  const battle = {left:topLeft.x-margin,top:topLeft.y-margin,
    right:bottomRight.x+margin,bottom:bottomRight.y+margin};
  const hud = {left:0,top:0,right:width,bottom:coarse?116:98};
  const controls = {left:0,top:height-(coarse?120:80),right:width,bottom:height};
  return !rectanglesOverlap(rect,battle) &&
    !rectanglesOverlap(rect,hud) && !rectanglesOverlap(rect,controls);
}
type ProjectBounds = (camera: THREE.Camera, width: number, height: number) => ScreenRect;
interface Decoration {
  readonly object: THREE.Object3D; readonly bounds: ProjectBounds;
}
/**
 * Rendering layers are presentation-only, never game physics or input layers.
 * Foreground materials are copied, made opaque and depth-write-free, and drawn BEFORE combat;
 * visibility is re-evaluated on resize and every moving frame.
 */
export class CombatSceneLayers {
  readonly starfield = new THREE.Group();
  readonly celestial = new THREE.Group();
  readonly environment = new THREE.Group();
  readonly combat = new THREE.Group();
  readonly foreground = new THREE.Group();
  private readonly decorations: Decoration[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  constructor(scene: THREE.Scene) {
    for (const [index,name] of SCENE_LAYER_ORDER.entries()) {
      const group = this[name];
      group.name = 'p3-'+name;
      // Foreground occupies an EARLIER render pass than combat to avoid z-based occlusion.
      group.renderOrder = name === 'foreground' ? 30 : name === 'combat' ? 100 : index;
      scene.add(group);
    }
  }
  /** Required gate for all future foreground props (issue #45). */
  addForeground(object: THREE.Object3D, bounds: ProjectBounds): void {
    object.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const clone = (material: THREE.Material): THREE.Material => {
        const copy=material.clone();
        copy.depthTest=false;
        copy.depthWrite=false;
        copy.transparent=false;
        copy.opacity=1;
        this.ownedMaterials.push(copy);
        return copy;
      };
      node.material = Array.isArray(node.material)
        ? node.material.map(clone) : clone(node.material);
    });
    this.foreground.add(object);
    object.visible=false; // Safety always fails closed until checked against the viewport.
    this.decorations.push({object,bounds});
  }
  refresh(world: World2, camera: THREE.Camera, width: number, height: number, coarse: boolean): void {
    for (const item of this.decorations) {
      try {
        item.object.visible=isSafeEdgeDecoration(item.bounds(camera,width,height),world,width,height,coarse);
      } catch {
        item.object.visible=false;
      }
    }
  }
  get foregroundCount(): number { return this.decorations.length; }
  get visibleForegroundCount(): number { return this.decorations.filter(d=>d.object.visible).length; }
  dispose(): void {
    for (const item of this.decorations) this.foreground.remove(item.object);
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedMaterials.length=0;
    this.decorations.length=0;
  }
}
