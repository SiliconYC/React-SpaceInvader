import type { Point2, World2 } from './world.ts';

/** P1 第一版严格 JSON 契约；可在未来迁移版本，不靠推断旧数据字段。 */
export type EnemyKind = 'scout' | 'raider' | 'guardian';
export const ENEMY_SIZES: Readonly<Record<EnemyKind, Readonly<{ width: number; height: number }>>> = Object.freeze({
  scout: Object.freeze({ width: 1.8, height: 1.2 }),
  raider: Object.freeze({ width: 2.0, height: 1.3 }),
  guardian: Object.freeze({ width: 2.3, height: 1.5 }),
});
export interface EnemyState {
  readonly id: string;
  readonly type: EnemyKind;
  readonly position: Readonly<Point2>;
  readonly width: number;
  readonly height: number;
}
export interface WavePlan {
  readonly id: string;
  readonly spawnAtSeconds: number;
  readonly formation: Readonly<{
    type: EnemyKind;
    rows: number; columns: number;
    startX: number; startY: number;
    spacingX: number; spacingY: number;
  }>;
  readonly movement: Readonly<{ horizontalSpeed: number; descentPerTurn: number; startDirection: -1 | 1; moveEveryTicks: number }>;
  readonly attack: Readonly<{ shotsPerMinute: number; projectileSpeed: number }>;
}
export interface LevelPlan {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly metadata: Readonly<{ name: string; description: string }>;
  readonly world: Readonly<World2>;
  readonly waves: readonly WavePlan[];
  readonly difficulty: Readonly<{ speedMultiplier: number; fireRateMultiplier: number }>;
  readonly victory: Readonly<{ type: 'clear-all-waves' }>;
}

/** 纯二维阵列生成：关卡、波次索引决定敌机类型、位置、数量及唯一 ID。 */
export function waveEnemies(level: LevelPlan, index: number): readonly EnemyState[] {
  const wave = level.waves[index];
  if (!wave || !Number.isInteger(index)) throw new RangeError('波次索引无效');
  const f = wave.formation;
  const size = ENEMY_SIZES[f.type];
  const enemies: EnemyState[] = [];
  for (let row = 0; row < f.rows; row++) {
    for (let col = 0; col < f.columns; col++) {
      enemies.push(Object.freeze({
        id: wave.id + '-' + row + '-' + col,
        type: f.type,
        position: Object.freeze({ x: f.startX + col * f.spacingX, y: f.startY - row * f.spacingY }),
        width: size.width, height: size.height,
      }));
    }
  }
  return Object.freeze(enemies);
}

/** 兼容既有单波测试；实际生成统一走 waveEnemies。 */
export function firstWaveEnemies(level: LevelPlan): readonly EnemyState[] {
  if (level.waves[0]?.spawnAtSeconds !== 0) throw new RangeError('首波必须在第 0 秒生成');
  return waveEnemies(level, 0);
}
