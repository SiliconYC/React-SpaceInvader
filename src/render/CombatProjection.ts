import type { Point2, World2 } from '../core/world.ts';

/** Render-only layout: every XY point is on the same focal plane. */
export interface CombatProjection {
  readonly spanX: number;
  readonly spanY: number;
  readonly centerY: number;
  readonly fovDegrees: number;
  readonly cameraDistance: number;
}
export function combatProjection(world: Readonly<World2>, width: number, height: number, coarse: boolean): CombatProjection {
  if (width <= 0 || height <= 0) throw new RangeError('Viewport must be positive');
  const aspect = width / height;
  const spanY = Math.max(world.height + (coarse ? 7 : 2.2), (world.width + 2.2) / aspect);
  const fovDegrees = 18;
  return {
    spanX: spanY * aspect, spanY, centerY: coarse ? -2.2 : 0, fovDegrees,
    cameraDistance: spanY / (2 * Math.tan((fovDegrees * Math.PI) / 360)),
  };
}
/** Pixel-space contract for the XY plane (origin: top-left). Both cameras MUST match. */
export function projectBattlePoint(point: Point2, world: Readonly<World2>,
  layout: CombatProjection, width: number, height: number): Point2 {
  const pixelsPerUnit = height / layout.spanY;
  return {
    x: width / 2 + (point.x - world.width / 2) * pixelsPerUnit,
    y: height / 2 - (point.y - world.height / 2 - layout.centerY) * pixelsPerUnit,
  };
}
