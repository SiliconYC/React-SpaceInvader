import { PLAYER_HEIGHT, PLAYER_WIDTH } from '../core/engine.ts';
import { ENEMY_SIZES, type EnemyKind, type LevelPlan, type WavePlan } from '../core/level.ts';
import { containsRect, validateWorld } from '../core/world.ts';

export class LevelValidationError extends Error {
  constructor(message: string) { super('关卡数据无效：' + message); this.name = 'LevelValidationError'; }
}
type Obj = Record<string, unknown>;
function obj(value: unknown, path: string, keys: readonly string[]): Obj {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new LevelValidationError(path + ' 必须是对象');
  }
  const record = value as Obj;
  for (const key of keys) if (!(key in record)) throw new LevelValidationError(path + ' 缺少 ' + key);
  for (const key of Object.keys(record)) if (!keys.includes(key)) throw new LevelValidationError(path + ' 包含未知字段 ' + key);
  return record;
}
function num(v: unknown, path: string, min: number, max: number, integer = false): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
    throw new LevelValidationError(path + ' 必须是 ' + min + '～' + max + ' 的' + (integer ? '整数' : '有限数字'));
  }
  return v;
}
function id(v: unknown, path: string): string {
  if (typeof v !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(v)) throw new LevelValidationError(path + ' 标识格式错误');
  return v;
}
function label(v: unknown, path: string, max: number): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new LevelValidationError(path + ' 必须是有效文本');
  return v;
}

/** 严格拒绝非法/未知字段与非法数值，不进行静默默认填充。 */
export function parseLevel(input: unknown): LevelPlan {
  const root = obj(input, '关卡', ['schemaVersion', 'id', 'metadata', 'world', 'waves', 'difficulty', 'victory']);
  if (root.schemaVersion !== 1) throw new LevelValidationError('不支持的 schemaVersion');
  const metadata = obj(root.metadata, 'metadata', ['name', 'description']);
  const w = obj(root.world, 'world', ['width', 'height']);
  const world = validateWorld({
    width: num(w.width, 'world.width', PLAYER_WIDTH + 2, 200),
    height: num(w.height, 'world.height', PLAYER_HEIGHT + 5, 200),
  });
  const d = obj(root.difficulty, 'difficulty', ['speedMultiplier', 'fireRateMultiplier']);
  const victory = obj(root.victory, 'victory', ['type']);
  if (victory.type !== 'clear-all-waves') throw new LevelValidationError('victory.type 不受支持');
  if (!Array.isArray(root.waves) || root.waves.length < 1 || root.waves.length > 16) {
    throw new LevelValidationError('waves 必须包含 1～16 波');
  }
  const seen = new Set<string>();
  let prevTime = -1;
  let sumEnemies = 0;
  const waves: WavePlan[] = root.waves.map((entry, index) => {
    const p = 'waves[' + index + ']';
    const wave = obj(entry, p, ['id', 'spawnAtSeconds', 'formation', 'movement', 'attack']);
    const waveId = id(wave.id, p + '.id');
    if (seen.has(waveId)) throw new LevelValidationError(p + '.id 重复');
    seen.add(waveId);
    const spawnAtSeconds = num(wave.spawnAtSeconds, p + '.spawnAtSeconds', 0, 3600);
    if (spawnAtSeconds <= prevTime) throw new LevelValidationError(p + '.spawnAtSeconds 必须严格递增');
    prevTime = spawnAtSeconds;
    const f = obj(wave.formation, p + '.formation', ['type', 'rows', 'columns', 'startX', 'startY', 'spacingX', 'spacingY']);
    if (typeof f.type !== 'string' || !Object.prototype.hasOwnProperty.call(ENEMY_SIZES, f.type)) {
      throw new LevelValidationError(p + '.formation.type 是未知敌机类型');
    }
    const type = f.type as EnemyKind;
    const rows = num(f.rows, p + '.formation.rows', 1, 12, true);
    const columns = num(f.columns, p + '.formation.columns', 1, 16, true);
    sumEnemies += rows * columns;
    if (sumEnemies > 256) throw new LevelValidationError('敌机总数不得超过 256');
    const spacingX = num(f.spacingX, p + '.formation.spacingX', ENEMY_SIZES[type].width + 0.05, 100);
    const spacingY = num(f.spacingY, p + '.formation.spacingY', ENEMY_SIZES[type].height + 0.05, 100);
    const startX = num(f.startX, p + '.formation.startX', 0, world.width);
    const startY = num(f.startY, p + '.formation.startY', 0, world.height);
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const position = { x: startX + col * spacingX, y: startY - row * spacingY };
      if (!containsRect(world, position, ENEMY_SIZES[type]) || position.y < PLAYER_HEIGHT + 4) {
        throw new LevelValidationError(p + '.formation 编队越界或侵入玩家区域');
      }
    }
    const m = obj(wave.movement, p + '.movement', ['horizontalSpeed', 'descentPerTurn']);
    const a = obj(wave.attack, p + '.attack', ['shotsPerMinute', 'projectileSpeed']);
    return Object.freeze({
      id: waveId, spawnAtSeconds,
      formation: Object.freeze({ type, rows, columns, startX, startY, spacingX, spacingY }),
      movement: Object.freeze({
        horizontalSpeed: num(m.horizontalSpeed, p + '.movement.horizontalSpeed', 0, 40),
        descentPerTurn: num(m.descentPerTurn, p + '.movement.descentPerTurn', 0, 30),
      }),
      attack: Object.freeze({
        shotsPerMinute: num(a.shotsPerMinute, p + '.attack.shotsPerMinute', 0, 240),
        projectileSpeed: num(a.projectileSpeed, p + '.attack.projectileSpeed', 0.1, 60),
      }),
    });
  });
  if (waves[0].spawnAtSeconds !== 0) throw new LevelValidationError('第一波 spawnAtSeconds 必须为 0');
  return Object.freeze({
    schemaVersion: 1, id: id(root.id, 'id'),
    metadata: Object.freeze({
      name: label(metadata.name, 'metadata.name', 48),
      description: label(metadata.description, 'metadata.description', 240),
    }),
    world, waves: Object.freeze(waves),
    difficulty: Object.freeze({
      speedMultiplier: num(d.speedMultiplier, 'difficulty.speedMultiplier', 0.1, 5),
      fireRateMultiplier: num(d.fireRateMultiplier, 'difficulty.fireRateMultiplier', 0.1, 5),
    }),
    victory: Object.freeze({ type: 'clear-all-waves' }),
  } satisfies LevelPlan);
}
