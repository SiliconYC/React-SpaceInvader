import { DEFAULT_WORLD, validateWorld, clampCenter, type Point2, type World2 } from './world.ts';

/** 仅使用二维逻辑位置；显示用的 z 不在状态中。 */
export interface PlayerState { readonly position: Readonly<Point2>; readonly width: number; readonly height: number }
export const PLAYER_WIDTH = 2.5;
export const PLAYER_HEIGHT = 1.4;
export const PLAYER_SPEED = 12; // 每秒世界逻辑单位
import { initialRandomState, nextRandomState, validateSeed } from './random.ts';

export const FIXED_HZ = 60;
export const FIXED_DELTA_SECONDS = 1 / FIXED_HZ;
export type GamePhase = 'ready' | 'running' | 'paused' | 'ended';
export type GameCommand =
  | { readonly type: 'START' }
  | { readonly type: 'PAUSE' }
  | { readonly type: 'RESUME' }
  | { readonly type: 'END' }
  | { readonly type: 'RESET' }
  | { readonly type: 'SET_MOVEMENT'; readonly direction: -1 | 0 | 1 };
export interface GameSnapshot {
  readonly phase: GamePhase;
  readonly tick: number;
  readonly elapsedSeconds: number;
  readonly seed: number;
  readonly randomState: number;
  readonly world: Readonly<World2>;
  readonly player: Readonly<PlayerState>;
}
export type GameEvent =
  | { readonly type: 'phase-changed'; readonly from: GamePhase; readonly to: GamePhase; readonly tick: number }
  | { readonly type: 'game-reset'; readonly tick: 0 };
export type CommandResult = { readonly accepted: true } | { readonly accepted: false; readonly reason: string };

const TRANSITIONS: Readonly<Record<Exclude<GameCommand['type'], 'RESET' | 'SET_MOVEMENT'>, readonly [GamePhase, GamePhase][]>> = {
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
  private events: GameEvent[] = [];
  private movement: -1 | 0 | 1 = 0;
  private playerX: number;
  private readonly playerY: number;

  constructor(seed = 1, world: World2 = DEFAULT_WORLD) {
    this.seed = validateSeed(seed);
    this.randomState = initialRandomState(this.seed);
    this.world = validateWorld(world);
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
      player: Object.freeze({
        position: Object.freeze({ x: this.playerX, y: this.playerY }),
        width: PLAYER_WIDTH, height: PLAYER_HEIGHT,
      }),
    });
  }

  dispatch(command: GameCommand): CommandResult {
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
      this.playerX = clampCenter(this.world, {
        x: this.playerX + this.movement * PLAYER_SPEED * FIXED_DELTA_SECONDS,
        y: this.playerY,
      }, { width: PLAYER_WIDTH, height: PLAYER_HEIGHT }).x;
      this.tick += 1;
    }
    return count;
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
