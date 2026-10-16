import { DEFAULT_WORLD, validateWorld, clampCenter, type Point2, type World2 } from './world.ts';

/** 仅使用二维逻辑位置；显示用的 z 不在状态中。 */
export interface PlayerState { readonly position: Readonly<Point2>; readonly width: number; readonly height: number }
export const PLAYER_WIDTH = 2.5;
export const PLAYER_HEIGHT = 1.4;
export const PLAYER_SPEED = 12; // 每秒世界逻辑单位
import { initialRandomState, nextRandomState, validateSeed } from './random.ts';
import { firstWaveEnemies, type EnemyState, type LevelPlan, type WavePlan } from './level.ts';
import { advanceFormation, type FormationDirection } from './formation.ts';
import { SHOT_SPEED, SHOT_WIDTH, SHOT_HEIGHT, SHOT_COOLDOWN_TICKS, ENEMY_POINTS,
  sweptHitTime, type ProjectileState } from './combat.ts';

export const FIXED_HZ = 60;
export const FIXED_DELTA_SECONDS = 1 / FIXED_HZ;
export type GamePhase = 'ready' | 'running' | 'paused' | 'ended';
export type GameCommand =
  | { readonly type: 'START' }
  | { readonly type: 'PAUSE' }
  | { readonly type: 'RESUME' }
  | { readonly type: 'END' }
  | { readonly type: 'RESET' }
  | { readonly type: 'SET_MOVEMENT'; readonly direction: -1 | 0 | 1 }
  | { readonly type: 'SET_FIRING'; readonly active: boolean }
  | { readonly type: 'FIRE' };
export interface GameSnapshot {
  readonly phase: GamePhase;
  readonly tick: number;
  readonly elapsedSeconds: number;
  readonly seed: number;
  readonly randomState: number;
  readonly world: Readonly<World2>;
  readonly player: Readonly<PlayerState>;
  readonly levelId: string | null;
  readonly enemies: readonly EnemyState[];
  readonly formationDirection: FormationDirection;
  readonly formationTurns: number;
  readonly score: number;
  readonly projectiles: readonly ProjectileState[];
  readonly nextShotTick: number;
}
export type GameEvent =
  | { readonly type: 'phase-changed'; readonly from: GamePhase; readonly to: GamePhase; readonly tick: number }
  | { readonly type: 'game-reset'; readonly tick: 0 }
  | { readonly type: 'shot-fired'; readonly bulletId: number; readonly tick: number }
  | { readonly type: 'enemy-hit'; readonly tick: number; readonly bulletId: number;
      readonly enemyId: string; readonly points: number; readonly position: Readonly<Point2> };
export type CommandResult = { readonly accepted: true } | { readonly accepted: false; readonly reason: string };

const TRANSITIONS: Readonly<Record<Exclude<GameCommand['type'], 'RESET' | 'SET_MOVEMENT' | 'SET_FIRING' | 'FIRE'>, readonly [GamePhase, GamePhase][]>> = {
  START: [['ready', 'running']],
  PAUSE: [['running', 'paused']],
  RESUME: [['paused', 'running']],
  END: [['running', 'ended'], ['paused', 'ended']],
};

export class GameEngine {
  private phase: GamePhase = 'ready';
  private tick = 0;
  private randomState: number;
  private accumulator = 0;
  private readonly seed: number;
  private readonly world: Readonly<World2>;
  private readonly levelId: string | null;
  private enemies: readonly EnemyState[];
  private readonly initialEnemies: readonly EnemyState[];
  private readonly formationSettings: WavePlan['movement'] | null;
  private readonly formationSpeedMultiplier: number;
  private formationDirection: FormationDirection;
  private formationTurns = 0;
  private events: GameEvent[] = [];
  private movement: -1 | 0 | 1 = 0;
  private playerX: number;
  private readonly playerY: number;
  private projectiles: readonly ProjectileState[] = Object.freeze([]);
  private score = 0;
  private firing = false;
  private nextShotTick = 0;
  private projectileSerial = 0;

  constructor(seed = 1, world: World2 = DEFAULT_WORLD, level?: LevelPlan) {
    this.seed = validateSeed(seed);
    this.randomState = initialRandomState(this.seed);
    this.world = validateWorld(world);
    if (level && (level.world.width !== this.world.width || level.world.height !== this.world.height)) {
      throw new RangeError('关卡宽高必须与引擎逻辑世界一致');
    }
    this.levelId = level?.id ?? null;
    this.initialEnemies = level ? firstWaveEnemies(level) : Object.freeze([] as EnemyState[]);
    this.enemies = this.initialEnemies;
    this.formationSettings = level?.waves[0].movement ?? null;
    this.formationSpeedMultiplier = level?.difficulty.speedMultiplier ?? 1;
    this.formationDirection = this.formationSettings?.startDirection ?? 1;
    if (this.world.width < PLAYER_WIDTH || this.world.height < PLAYER_HEIGHT + 2) {
      throw new RangeError('战场太小，无法容纳玩家飞船');
    }
    this.playerX = this.world.width / 2;
    this.playerY = PLAYER_HEIGHT / 2 + 1.5;
  }

  snapshot(): GameSnapshot {
    return Object.freeze({
      phase: this.phase, tick: this.tick, elapsedSeconds: this.tick / FIXED_HZ,
      seed: this.seed, randomState: this.randomState, world: this.world,
      levelId: this.levelId, enemies: this.enemies,
      formationDirection: this.formationDirection, formationTurns: this.formationTurns,
      score: this.score, projectiles: this.projectiles, nextShotTick: this.nextShotTick,
      player: Object.freeze({
        position: Object.freeze({ x: this.playerX, y: this.playerY }),
        width: PLAYER_WIDTH, height: PLAYER_HEIGHT,
      }),
    });
  }

  dispatch(command: GameCommand): CommandResult {
    if (command.type === 'SET_FIRING') {
      if (this.phase !== 'running' || typeof command.active !== 'boolean') {
        return { accepted: false, reason: '仅运行时允许合法的发射控制' };
      }
      this.firing = command.active;
      return { accepted: true };
    }
    if (command.type === 'FIRE') {
      if (this.phase !== 'running' || this.tick < this.nextShotTick) {
        return { accepted: false, reason: '无法在暂停或冷却期间射击' };
      }
      this.fire();
      return { accepted: true };
    }
    if (command.type === 'SET_MOVEMENT') {
      if (this.phase !== 'running' || ![-1, 0, 1].includes(command.direction)) {
        return { accepted: false, reason: '仅运行中允许合法左右移动命令' };
      }
      this.movement = command.direction;
      return { accepted: true };
    }
    if (command.type === 'RESET') {
      this.phase = 'ready';
      this.tick = 0;
      this.accumulator = 0;
      this.randomState = initialRandomState(this.seed);
      this.playerX = this.world.width / 2;
      this.enemies = this.initialEnemies;
      this.formationDirection = this.formationSettings?.startDirection ?? 1;
      this.formationTurns = 0;
      this.projectiles = Object.freeze([]);
      this.score = 0;
      this.firing = false;
      this.nextShotTick = 0;
      this.projectileSerial = 0;
      this.movement = 0;
      this.events.push({ type: 'game-reset', tick: 0 });
      return { accepted: true };
    }
    const target = TRANSITIONS[command.type]?.find(([from]) => from === this.phase);
    if (!target) return { accepted: false, reason: '当前阶段不允许执行 ' + command.type };
    const from = this.phase;
    this.phase = target[1];
    // 失焦/暂停/重新开始后不得残留按键方向。
    this.movement = 0;
    this.firing = false;
    // 暂停/继续/重新开始时，不把渲染空档算成游戏时间。
    this.accumulator = 0;
    this.events.push({ type: 'phase-changed', from, to: this.phase, tick: this.tick });
    return { accepted: true };
  }

  /** 纯逻辑步进。仅 running 阶段生效；未来实体系统接入此单一入口。 */
  stepTicks(count = 1): number {
    if (!Number.isSafeInteger(count) || count < 0 || count > 36000) {
      throw new RangeError('逻辑步进数量无效');
    }
    if (this.phase !== 'running') return 0;
    for (let step = 0; step < count; step++) {
      const previousEnemies = this.enemies;
      this.playerX = clampCenter(this.world, {
        x: this.playerX + this.movement * PLAYER_SPEED * FIXED_DELTA_SECONDS,
        y: this.playerY,
      }, { width: PLAYER_WIDTH, height: PLAYER_HEIGHT }).x;
      this.tick += 1;
      if (this.formationSettings && this.tick % this.formationSettings.moveEveryTicks === 0) {
        const result = advanceFormation(this.enemies, this.world, this.formationSettings,
          this.formationSpeedMultiplier, this.formationDirection, this.formationSettings.moveEveryTicks);
        this.enemies = result.enemies;
        this.formationDirection = result.direction;
        this.formationTurns += result.turns;
      }
      if (this.firing && this.tick >= this.nextShotTick) this.fire();
      this.updateProjectiles(previousEnemies);
    }
    return count;
  }

  /** 仅通过规则时钟/合法命令产生的子弹；按整数 tick 冷却。 */
  private fire(): void {
    const bullet = Object.freeze({
      id: ++this.projectileSerial,
      position: Object.freeze({ x: this.playerX, y: this.playerY + PLAYER_HEIGHT / 2 + SHOT_HEIGHT / 2 }),
      width: SHOT_WIDTH, height: SHOT_HEIGHT,
    });
    this.projectiles = Object.freeze([...this.projectiles, bullet]);
    this.nextShotTick = this.tick + SHOT_COOLDOWN_TICKS;
    this.events.push({ type: 'shot-fired', bulletId: bullet.id, tick: this.tick });
  }

  private updateProjectiles(previousEnemies: readonly EnemyState[]): void {
    if (this.projectiles.length === 0) return;
    const before = new Map(previousEnemies.map(enemy => [enemy.id, enemy]));
    const alive = new Map(this.enemies.map(enemy => [enemy.id, enemy]));
    const survivors: ProjectileState[] = [];
    for (const bullet of this.projectiles) {
      const origin = bullet.position;
      const end: Point2 = { x: origin.x, y: origin.y + SHOT_SPEED * FIXED_DELTA_SECONDS };
      let first: { enemy: EnemyState; time: number } | null = null;
      for (const enemy of alive.values()) {
        const old = before.get(enemy.id)?.position ?? enemy.position;
        const time = sweptHitTime(origin, end, old, enemy.position,
          (enemy.width + bullet.width) / 2, (enemy.height + bullet.height) / 2);
        if (time === null) continue;
        if (first === null || time < first.time - 1e-10 ||
            (Math.abs(time - first.time) <= 1e-10 && enemy.id < first.enemy.id)) {
          first = { enemy, time };
        }
      }
      if (first !== null) {
        const hit = first.enemy;
        alive.delete(hit.id); // 同一目标只可被击毁、计分一次
        const points = ENEMY_POINTS[hit.type];
        this.score += points;
        this.events.push({
          type: 'enemy-hit', tick: this.tick, bulletId: bullet.id,
          enemyId: hit.id, points,
          position: Object.freeze({
            x: hit.position.x, y: hit.position.y,
          }),
        });
      } else if (end.y - bullet.height / 2 <= this.world.height) {
        survivors.push(Object.freeze({ ...bullet, position: Object.freeze(end) }));
      }
    }
    this.enemies = Object.freeze(this.enemies.filter(enemy => alive.has(enemy.id)));
    this.projectiles = Object.freeze(survivors);
  }

  /** 渲染帧间隔 -> 整数次固定 60Hz 更新；不按渲染帧数推进规则。 */
  advanceFrame(seconds: number): number {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 600) {
      throw new RangeError('帧时间必须是 0～600 秒的有限数');
    }
    if (this.phase !== 'running') return 0;
    const total = this.accumulator + seconds;
    const steps = Math.floor(total * FIXED_HZ + 1e-9);
    if (steps > 36000) throw new RangeError('单次逻辑步进过大');
    this.accumulator = Math.max(0, total - steps / FIXED_HZ);
    return this.stepTicks(steps);
  }

  /** 仅规则核心拥有随机数流；不由 Three.js 或 React 抽取游戏随机数。 */
  nextRandom(): number {
    this.randomState = nextRandomState(this.randomState);
    return this.randomState / 0x100000000;
  }

  drainEvents(): GameEvent[] {
    const pending = this.events;
    this.events = [];
    return pending;
  }
}
