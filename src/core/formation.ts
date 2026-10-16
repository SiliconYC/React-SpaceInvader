import type { EnemyState, WavePlan } from './level.ts';
import type { World2 } from './world.ts';

export type FormationDirection = -1 | 1;
export interface FormationResult {
  readonly enemies: readonly EnemyState[];
  readonly direction: FormationDirection;
  readonly turns: number;
}

/**
 * 仅规则层计算二维集体移动。通过物理边界反射剩余路程，不因大步长越界。
 * 下降保留到世界边界；失败/伤害规则将在后续 Issue 实现。
 * 空阵列保持方向，便于 #7 消灭目标后稳定运作。
 */
export function advanceFormation(
  enemies: readonly EnemyState[], world: World2,
  movement: WavePlan['movement'], speedMultiplier: number,
  direction: FormationDirection, elapsedTicks: number,
): FormationResult {
  if (!enemies.length) return { enemies, direction, turns: 0 };
  const left = Math.min(...enemies.map(e => e.position.x - e.width / 2));
  const right = Math.max(...enemies.map(e => e.position.x + e.width / 2));
  const gap = world.width - (right - left);
  if (gap <= 1e-8 || movement.horizontalSpeed === 0) return { enemies, direction, turns: 0 };
  let leftPosition = left;
  let heading = direction;
  let remaining = movement.horizontalSpeed * speedMultiplier * elapsedTicks / 60;
  let turns = 0;
  // Every pass consumes distance except an exact edge collision which reverses direction.
  while (remaining > 1e-10) {
    const distance = heading === 1 ? world.width - (leftPosition + right - left) : leftPosition;
    if (distance <= 1e-10) {
      heading = heading === 1 ? -1 : 1;
      turns++;
      continue;
    }
    const step = Math.min(distance, remaining);
    leftPosition += heading * step;
    remaining -= step;
    if (distance - step <= 1e-10) {
      heading = heading === 1 ? -1 : 1;
      turns++;
    }
  }
  const dx = leftPosition - left;
  const bottom = Math.min(...enemies.map(e => e.position.y - e.height / 2));
  const dy = -Math.min(bottom, turns * movement.descentPerTurn);
  const shifted = Object.freeze(enemies.map(e => Object.freeze({
    ...e,
    position: Object.freeze({ x: e.position.x + dx, y: e.position.y + dy }),
  })));
  return { enemies: shifted, direction: heading, turns };
}
