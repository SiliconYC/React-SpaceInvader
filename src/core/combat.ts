import type { Point2 } from './world.ts';
import type { EnemyKind } from './level.ts';

export const SHOT_SPEED = 25; // 世界单位/秒，独立于渲染帧率
export const SHOT_WIDTH = 0.20;
export const SHOT_HEIGHT = 0.55;
export const SHOT_COOLDOWN_TICKS = 12; // 60Hz 时每秒最多 5 发
export const ENEMY_POINTS: Readonly<Record<EnemyKind, number>> =
  Object.freeze({ scout: 10, raider: 20, guardian: 30 });

export interface ProjectileState {
  readonly id: number;
  readonly position: Readonly<Point2>;
  readonly width: number;
  readonly height: number;
}

/**
 * 相对坐标系中的扫掠 AABB：玩家弹中心从 start -> end，敌机中心从
 * enemyStart -> enemyEnd，矩形按双方半尺寸扩张。返回最早碰撞比例 [0,1]，
 * 既能防止高弹速穿透，也能处理当前 tick 敌机横移/下降。
 * 此函数纯二维，不查询 Three.js 或 DOM。
 */
export function sweptHitTime(
  start: Point2, end: Point2,
  enemyStart: Point2, enemyEnd: Point2,
  totalHalfWidth: number, totalHalfHeight: number,
): number | null {
  const relativeStart = { x: start.x - enemyStart.x, y: start.y - enemyStart.y };
  const relativeEnd = { x: end.x - enemyEnd.x, y: end.y - enemyEnd.y };
  let enter = 0;
  let exit = 1;
  for (const axis of ['x', 'y'] as const) {
    const p = relativeStart[axis], velocity = relativeEnd[axis] - p;
    const half = axis === 'x' ? totalHalfWidth : totalHalfHeight;
    if (Math.abs(velocity) < 1e-12) {
      if (p < -half || p > half) return null;
      continue;
    }
    const one = (-half - p) / velocity;
    const two = (half - p) / velocity;
    enter = Math.max(enter, Math.min(one, two));
    exit = Math.min(exit, Math.max(one, two));
    if (enter > exit) return null;
  }
  return enter <= 1 && exit >= 0 ? Math.max(0, enter) : null;
}
