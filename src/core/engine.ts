import { DEFAULT_WORLD, validateWorld, clampCenter, type Point2, type World2 } from './world.ts';
import { initialRandomState, nextRandomState, validateSeed } from './random.ts';
import { firstWaveEnemies, type EnemyState, type LevelPlan, type WavePlan } from './level.ts';
import { advanceFormation, type FormationDirection } from './formation.ts';
import {
  SHOT_SPEED, SHOT_WIDTH, SHOT_HEIGHT, SHOT_COOLDOWN_TICKS, ENEMY_POINTS,
  sweptHitTime, type ProjectileState,
} from './combat.ts';

export interface PlayerState { readonly position: Readonly<Point2>; readonly width: number; readonly height: number }
export const PLAYER_WIDTH = 2.5;
export const PLAYER_HEIGHT = 1.4;
export const PLAYER_SPEED = 12;
export const INITIAL_LIVES = 3;
export const DAMAGE_IMMUNITY_TICKS = 60;
export const FIXED_HZ = 60;
export const FIXED_DELTA_SECONDS = 1 / FIXED_HZ;
export type GamePhase = 'ready' | 'running' | 'paused' | 'ended' | 'won' | 'lost';
export type GameOutcome = 'cleared' | 'lives-exhausted' | 'line-breached';
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
  readonly outcome: GameOutcome | null;
  readonly tick: number;
  readonly elapsedSeconds: number;
  readonly seed: number;
  readonly randomState: number;
  readonly world: Readonly<World2>;
  readonly player: Readonly<PlayerState>;
  readonly lives: number;
  readonly invulnerableUntilTick: number;
  readonly defenseLineY: number;
  readonly levelId: string | null;
  readonly pendingWaves: number;
  readonly enemies: readonly EnemyState[];
  readonly formationDirection: FormationDirection;
  readonly formationTurns: number;
  readonly score: number;
  readonly projectiles: readonly ProjectileState[];
  readonly enemyProjectiles: readonly ProjectileState[];
  readonly nextShotTick: number;
  readonly nextEnemyShotTick: number | null;
}

export type GameEvent =
  | { readonly type: 'phase-changed'; readonly from: GamePhase; readonly to: GamePhase; readonly tick: number }
  | { readonly type: 'game-reset'; readonly tick: 0 }
  | { readonly type: 'shot-fired'; readonly bulletId: number; readonly tick: number }
  | { readonly type: 'enemy-shot-fired'; readonly bulletId: number; readonly enemyId: string; readonly tick: number }
  | { readonly type: 'enemy-hit'; readonly tick: number; readonly bulletId: number;
      readonly enemyId: string; readonly points: number; readonly position: Readonly<Point2> }
  | { readonly type: 'player-hit'; readonly tick: number; readonly bulletId: number;
      readonly lives: number; readonly position: Readonly<Point2> }
  | { readonly type: 'game-finished'; readonly tick: number; readonly phase: 'won' | 'lost'; readonly outcome: GameOutcome };

export type CommandResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: string };

const TRANSITIONS: Readonly<Record<Exclude<GameCommand['type'],
  'RESET' | 'SET_MOVEMENT' | 'SET_FIRING' | 'FIRE'>, readonly [GamePhase, GamePhase][]>> = {
  START: [['ready', 'running']],
  PAUSE: [['running', 'paused']],
  RESUME: [['paused', 'running']],
  END: [['running', 'ended'], ['paused', 'ended']],
};

export class GameEngine {
  private phase: GamePhase = 'ready';
  private outcome: GameOutcome | null = null;
  private tick = 0;
  private randomState: number;
  private accumulator = 0;
  private readonly seed: number;
  private readonly world: Readonly<World2>;
  private readonly levelId: string | null;
  private readonly pendingWaves: number;
  private enemies: readonly EnemyState[];
  private readonly initialEnemies: readonly EnemyState[];
  private readonly formationSettings: WavePlan['movement'] | null;
  private readonly formationSpeedMultiplier: number;
  private readonly enemyAttack: WavePlan['attack'] | null;
  private readonly enemyShotInterval: number | null;
  private nextEnemyShotTick: number | null;
  private formationDirection: FormationDirection;
  private formationTurns = 0;
  private events: GameEvent[] = [];
  private movement: -1 | 0 | 1 = 0;
  private playerX: number;
  private readonly playerY: number;
  private readonly defenseLineY: number;
  private lives = INITIAL_LIVES;
  private invulnerableUntilTick = 0;
  private projectiles: readonly ProjectileState[] = Object.freeze([]);
  private enemyProjectiles: readonly ProjectileState[] = Object.freeze([]);
  private score = 0;
  private firing = false;
  private nextShotTick = 0;
  private projectileSerial = 0;
  private enemyProjectileSerial = 0;

  constructor(seed = 1, world: World2 = DEFAULT_WORLD, level?: LevelPlan) {
    this.seed = validateSeed(seed);
    this.randomState = initialRandomState(this.seed);
    this.world = validateWorld(world);
    if (level && (level.world.width !== this.world.width || level.world.height !== this.world.height)) {
      throw new RangeError('关卡宽高必须与引擎逻辑世界一致');
    }
    if (this.world.width < PLAYER_WIDTH || this.world.height < PLAYER_HEIGHT + 2) {
      throw new RangeError('战场太小，无法容纳玩家飞船');
    }
    this.levelId = level?.id ?? null;
    this.pendingWaves = Math.max(0, (level?.waves.length ?? 1) - 1);
    this.initialEnemies = level ? firstWaveEnemies(level) : Object.freeze([] as EnemyState[]);
    this.enemies = this.initialEnemies;
    this.formationSettings = level?.waves[0].movement ?? null;
    this.formationSpeedMultiplier = level?.difficulty.speedMultiplier ?? 1;
    this.formationDirection = this.formationSettings?.startDirection ?? 1;
    this.enemyAttack = level?.waves[0].attack ?? null;
    const shotsPerMinute = (this.enemyAttack?.shotsPerMinute ?? 0) * (level?.difficulty.fireRateMultiplier ?? 1);
    this.enemyShotInterval = shotsPerMinute > 0 ? Math.max(1, Math.round(3600 / shotsPerMinute)) : null;
    this.nextEnemyShotTick = this.enemyShotInterval;
    this.playerX = this.world.width / 2;
    this.playerY = PLAYER_HEIGHT / 2 + 1.5;
    this.defenseLineY = this.playerY + PLAYER_HEIGHT / 2 + 0.5;
  }

  snapshot(): GameSnapshot {
    return Object.freeze({
      phase: this.phase, outcome: this.outcome, tick: this.tick,
      elapsedSeconds: this.tick / FIXED_HZ,
      seed: this.seed, randomState: this.randomState, world: this.world,
      levelId: this.levelId, pendingWaves: this.pendingWaves,
      enemies: this.enemies, formationDirection: this.formationDirection,
      formationTurns: this.formationTurns,
      player: Object.freeze({
        position: Object.freeze({ x: this.playerX, y: this.playerY }),
        width: PLAYER_WIDTH, height: PLAYER_HEIGHT,
      }),
      lives: this.lives, invulnerableUntilTick: this.invulnerableUntilTick,
      defenseLineY: this.defenseLineY,
      score: this.score, projectiles: this.projectiles, enemyProjectiles: this.enemyProjectiles,
      nextShotTick: this.nextShotTick, nextEnemyShotTick: this.nextEnemyShotTick,
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
        return { accepted: false, reason: '无法在暂停、终局或冷却期间射击' };
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
      const previous = this.phase;
      this.phase = 'ready';
      this.outcome = null;
      this.tick = 0;
      this.accumulator = 0;
      this.randomState = initialRandomState(this.seed);
      this.playerX = this.world.width / 2;
      this.enemies = this.initialEnemies;
      this.formationDirection = this.formationSettings?.startDirection ?? 1;
      this.formationTurns = 0;
      this.projectiles = Object.freeze([]);
      this.enemyProjectiles = Object.freeze([]);
      this.score = 0;
      this.lives = INITIAL_LIVES;
      this.invulnerableUntilTick = 0;
      this.firing = false;
      this.nextShotTick = 0;
      this.nextEnemyShotTick = this.enemyShotInterval;
      this.projectileSerial = 0;
      this.enemyProjectileSerial = 0;
      this.movement = 0;
      this.events = [{ type: 'game-reset', tick: 0 }];
      if (previous !== 'ready') this.events.push({ type: 'phase-changed', from: previous, to: 'ready', tick: 0 });
      return { accepted: true };
    }
    const target = TRANSITIONS[command.type]?.find(([from]) => from === this.phase);
    if (!target) return { accepted: false, reason: '当前阶段不允许执行 ' + command.type };
    const from = this.phase;
    this.phase = target[1];
    this.movement = 0;
    this.firing = false;
    this.accumulator = 0;
    this.events.push({ type: 'phase-changed', from, to: this.phase, tick: this.tick });
    return { accepted: true };
  }

  stepTicks(count = 1): number {
    if (!Number.isSafeInteger(count) || count < 0 || count > 36000) {
      throw new RangeError('逻辑步进数量无效');
    }
    if (this.phase !== 'running') return 0;
    let advanced = 0;
    for (let step = 0; step < count && this.phase === 'running'; step++) {
      const previousPlayer = Object.freeze({ x: this.playerX, y: this.playerY });
      const previousEnemies = this.enemies;
      this.playerX = clampCenter(this.world, {
        x: this.playerX + this.movement * PLAYER_SPEED * FIXED_DELTA_SECONDS,
        y: this.playerY,
      }, { width: PLAYER_WIDTH, height: PLAYER_HEIGHT }).x;
      this.tick++;
      advanced++;
      if (this.formationSettings && this.tick % this.formationSettings.moveEveryTicks === 0) {
        const result = advanceFormation(this.enemies, this.world, this.formationSettings,
          this.formationSpeedMultiplier, this.formationDirection, this.formationSettings.moveEveryTicks);
        this.enemies = result.enemies;
        this.formationDirection = result.direction;
        this.formationTurns += result.turns;
      }
      if (this.firing && this.tick >= this.nextShotTick) this.fire();
      this.updatePlayerProjectiles(previousEnemies);
      if (this.enemies.length === 0 && this.pendingWaves === 0 && this.initialEnemies.length > 0) {
        this.finish('won', 'cleared');
        break;
      }
      if (this.enemies.some(enemy => enemy.position.y - enemy.height / 2 <= this.defenseLineY)) {
        this.finish('lost', 'line-breached');
        break;
      }
      this.spawnEnemyShot();
      this.updateEnemyProjectiles(previousPlayer);
    }
    return advanced;
  }

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

  private updatePlayerProjectiles(previousEnemies: readonly EnemyState[]): void {
    if (!this.projectiles.length) return;
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
        alive.delete(hit.id);
        const points = ENEMY_POINTS[hit.type];
        this.score += points;
        this.events.push({
          type: 'enemy-hit', tick: this.tick, bulletId: bullet.id,
          enemyId: hit.id, points,
          position: Object.freeze({ x: hit.position.x, y: hit.position.y }),
        });
      } else if (end.y - bullet.height / 2 <= this.world.height) {
        survivors.push(Object.freeze({ ...bullet, position: Object.freeze(end) }));
      }
    }
    this.enemies = Object.freeze(this.enemies.filter(enemy => alive.has(enemy.id)));
    this.projectiles = Object.freeze(survivors);
  }

  /** 从每列最靠近玩家的存活敌机中，按种子选择合法发射者。 */
  private spawnEnemyShot(): void {
    if (this.enemyShotInterval === null || this.nextEnemyShotTick === null) return;
    if (this.tick < this.nextEnemyShotTick || !this.enemies.length) return;
    this.nextEnemyShotTick = this.tick + this.enemyShotInterval;
    const columns = new Map<string, EnemyState>();
    for (const enemy of this.enemies) {
      // 当前仅第一波固定编队；ID 最后一段为初始列号，删除敌人后仍保持列身份。
      const column = enemy.id.slice(enemy.id.lastIndexOf('-') + 1);
      const previous = columns.get(column);
      if (!previous || enemy.position.y < previous.position.y) columns.set(column, enemy);
    }
    const shooters = [...columns.values()].sort((a, b) => a.position.x - b.position.x || a.id.localeCompare(b.id));
    const shooter = shooters[Math.floor(this.nextRandom() * shooters.length)];
    const bullet = Object.freeze({
      id: ++this.enemyProjectileSerial,
      position: Object.freeze({
        x: shooter.position.x,
        y: shooter.position.y - shooter.height / 2 - SHOT_HEIGHT / 2,
      }),
      width: SHOT_WIDTH, height: SHOT_HEIGHT,
    });
    this.enemyProjectiles = Object.freeze([...this.enemyProjectiles, bullet]);
    this.events.push({ type: 'enemy-shot-fired', bulletId: bullet.id, enemyId: shooter.id, tick: this.tick });
  }

  private updateEnemyProjectiles(previousPlayer: Point2): void {
    if (!this.enemyProjectiles.length || !this.enemyAttack) return;
    const currentPlayer = { x: this.playerX, y: this.playerY };
    const survivors: ProjectileState[] = [];
    for (const bullet of this.enemyProjectiles) {
      const end: Point2 = {
        x: bullet.position.x,
        y: bullet.position.y - this.enemyAttack.projectileSpeed * FIXED_DELTA_SECONDS,
      };
      const hit = sweptHitTime(bullet.position, end, previousPlayer, currentPlayer,
        (PLAYER_WIDTH + bullet.width) / 2, (PLAYER_HEIGHT + bullet.height) / 2);
      if (hit !== null) {
        if (this.tick >= this.invulnerableUntilTick && this.lives > 0) {
          this.lives--;
          this.invulnerableUntilTick = this.tick + DAMAGE_IMMUNITY_TICKS;
          this.events.push({
            type: 'player-hit', tick: this.tick, bulletId: bullet.id,
            lives: this.lives, position: Object.freeze({ ...currentPlayer }),
          });
          if (this.lives === 0) {
            this.finish('lost', 'lives-exhausted');
            return;
          }
        }
        // Each bullet is consumed exactly once, also while invulnerable.
      } else if (end.y + bullet.height / 2 >= 0) {
        survivors.push(Object.freeze({ ...bullet, position: Object.freeze(end) }));
      }
    }
    this.enemyProjectiles = Object.freeze(survivors);
  }

  private finish(phase: 'won' | 'lost', outcome: GameOutcome): void {
    if (this.phase !== 'running') return;
    this.phase = phase;
    this.outcome = outcome;
    this.accumulator = 0;
    this.movement = 0;
    this.firing = false;
    this.projectiles = Object.freeze([]);
    this.enemyProjectiles = Object.freeze([]);
    this.events.push({ type: 'phase-changed', from: 'running', to: phase, tick: this.tick });
    this.events.push({ type: 'game-finished', tick: this.tick, phase, outcome });
  }

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
