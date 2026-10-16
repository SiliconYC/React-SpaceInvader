/** 规则使用的全部空间数据仅包含二维 x/y，不包含渲染用的 z。 */
export interface Point2 { readonly x: number; readonly y: number }
export interface Size2 { readonly width: number; readonly height: number }
export interface World2 extends Size2 {}
/** 横向战场，逻辑宽高比 3:2；屏幕尺寸变化只影响投影，不修改此值。 */
export const DEFAULT_WORLD: Readonly<World2> = Object.freeze({ width: 36, height: 24 });

export function validateWorld(world: World2): World2 {
  if (!Number.isFinite(world.width) || !Number.isFinite(world.height) ||
      world.width <= 0 || world.height <= 0 || world.width > 10000 || world.height > 10000) {
    throw new RangeError('战场宽高必须是 0～10000 之间的有限正数');
  }
  return Object.freeze({ width: world.width, height: world.height });
}

/** 左下角 (0,0)、右上角 (width,height)。矩形以中心点及宽高表示。 */
export function containsPoint(world: World2, point: Point2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= world.width &&
    point.y >= 0 && point.y <= world.height;
}
export function containsRect(world: World2, center: Point2, size: Size2): boolean {
  return Number.isFinite(size.width) && Number.isFinite(size.height) &&
    size.width > 0 && size.height > 0 &&
    containsPoint(world, { x: center.x - size.width / 2, y: center.y - size.height / 2 }) &&
    containsPoint(world, { x: center.x + size.width / 2, y: center.y + size.height / 2 });
}
export function clampCenter(world: World2, point: Point2, size: Size2): Point2 {
  if (![point.x, point.y, size.width, size.height].every(Number.isFinite) ||
      size.width <= 0 || size.height <= 0 ||
      size.width > world.width || size.height > world.height) {
    throw new RangeError('单位坐标或尺寸无效');
  }
  return {
    x: Math.max(size.width / 2, Math.min(world.width - size.width / 2, point.x)),
    y: Math.max(size.height / 2, Math.min(world.height - size.height / 2, point.y)),
  };
}
