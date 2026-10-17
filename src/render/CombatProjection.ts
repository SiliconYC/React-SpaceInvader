import type { Point2, World2 } from '../core/world.ts';

/** 两套真实 Three.js 摄影构图，互不改变世界坐标与碰撞。 */
export type BattleComposition = 'stage' | 'breathing';
export function compositionFromSearch(search: string): BattleComposition {
  return new URLSearchParams(search).get('composition') === 'breathing' ? 'breathing' : 'stage';
}
/** Render-only layout: every XY point stays on the same z=0 focal plane. */
export interface CombatProjection {
  readonly spanX: number;
  readonly spanY: number;
  readonly centerY: number;
  readonly fovDegrees: number;
  readonly cameraDistance: number;
}
export function combatProjection(world: Readonly<World2>, width: number, height: number, coarse: boolean,
  composition: BattleComposition = 'stage'): CombatProjection {
  if (width <= 0 || height <= 0) throw new RangeError('Viewport must be positive');
  const aspect = width / height;
  // Stage: the fleet is the subject. Breathing: a deliberately wider, quieter A/B alternative.
  // The long/short dimensions are derived from the *same* scalar: no stretching of XY physics.
  const safeX = composition === 'stage' ? 2.6 : 8;
  const safeY = composition === 'stage' ? 2.8 : 6.4;
  const coarseBottomSpace = coarse ? (composition === 'stage' ? 7.4 : 9) : 0;
  const spanY = Math.max(world.height + safeY + coarseBottomSpace,
    (world.width + safeX) / aspect);
  const fovDegrees = 18;
  return {
    spanX: spanY * aspect, spanY,
    centerY: coarse ? -2.05 : composition === 'stage' ? -0.3 : 0,
    fovDegrees,
    cameraDistance: spanY / (2 * Math.tan((fovDegrees * Math.PI) / 360)),
  };
}
/** Pixel-space contract for XY (origin: top-left), shared by both camera types. */
export function projectBattlePoint(point: Point2, world: Readonly<World2>,
  layout: CombatProjection, width: number, height: number): Point2 {
  const pixelsPerUnit = height / layout.spanY;
  return {
    x: width / 2 + (point.x - world.width / 2) * pixelsPerUnit,
    y: height / 2 - (point.y - world.height / 2 - layout.centerY) * pixelsPerUnit,
  };
}
