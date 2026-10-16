import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, FIXED_HZ } from '../src/core/engine.ts';
import { clampCenter, containsPoint, containsRect, DEFAULT_WORLD } from '../src/core/world.ts';

test('相同初始种子、命令、帧序列与随机消耗给出相同状态及事件', () => {
  const replay = (seed: number) => {
    const game = new GameEngine(seed);
    game.dispatch({ type: 'START' });
    const draws = [game.nextRandom(), game.nextRandom()];
    for (let i = 0; i < 30; i++) game.advanceFrame(1 / 30);
    game.dispatch({ type: 'PAUSE' });
    game.advanceFrame(17);
    game.dispatch({ type: 'RESUME' });
    game.stepTicks(4);
    return { draws, state: game.snapshot(), events: game.drainEvents() };
  };
  assert.deepEqual(replay(42), replay(42));
  assert.notDeepEqual(replay(42).draws, replay(43).draws);
  assert.equal(replay(42).state.tick, 64);
});

test('非法命令绝不修改状态或事件', () => {
  const game = new GameEngine();
  const before = game.snapshot();
  assert.equal(game.dispatch({ type: 'PAUSE' }).accepted, false);
  assert.deepEqual(game.snapshot(), before);
  assert.deepEqual(game.drainEvents(), []);
  assert.equal(game.dispatch({ type: 'START' }).accepted, true);
  const running = game.snapshot();
  assert.equal(game.dispatch({ type: 'START' }).accepted, false);
  assert.deepEqual(game.snapshot(), running);
});

test('不同渲染帧率得到一致逻辑时间，且暂停没有追赶时间', () => {
  const a = new GameEngine(99);
  const b = new GameEngine(99);
  a.dispatch({ type: 'START' });
  b.dispatch({ type: 'START' });
  for (let i = 0; i < 120; i++) a.advanceFrame(1 / 60);
  for (let i = 0; i < 48; i++) b.advanceFrame(1 / 24);
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.equal(a.snapshot().elapsedSeconds, 2);
  a.dispatch({ type: 'PAUSE' });
  a.advanceFrame(5);
  assert.equal(a.snapshot().tick, 120);
  a.dispatch({ type: 'RESUME' });
  a.advanceFrame(1 / 60);
  assert.equal(a.snapshot().tick, 121);
});

test('结束、重置、固定 tick、输入校验与状态快照隔离', () => {
  const game = new GameEngine(0);
  assert.throws(() => new GameEngine(-1), RangeError);
  assert.throws(() => new GameEngine(1, { width: NaN, height: 1 }), RangeError);
  assert.throws(() => game.advanceFrame(-0.1), RangeError);
  assert.throws(() => game.stepTicks(1.5), RangeError);
  game.dispatch({ type: 'START' });
  game.stepTicks(FIXED_HZ);
  game.nextRandom();
  game.dispatch({ type: 'END' });
  assert.equal(game.stepTicks(30), 0);
  assert.equal(game.snapshot().phase, 'ended');
  game.dispatch({ type: 'RESET' });
  assert.equal(game.snapshot().tick, 0);
  assert.equal(game.snapshot().phase, 'ready');
  assert.equal(game.snapshot().randomState, new GameEngine(0).snapshot().randomState);
  assert.equal(Object.isFrozen(game.snapshot()), true);
  assert.equal(Object.isFrozen(game.snapshot().world), true);
});

test('所有命中/边界工具只包含二维坐标并校验单位尺寸', () => {
  assert.equal(containsPoint(DEFAULT_WORLD, { x: 0, y: 0 }), true);
  assert.equal(containsPoint(DEFAULT_WORLD, { x: 24.001, y: 0 }), false);
  assert.equal(containsRect(DEFAULT_WORLD, { x: 1, y: 1 }, { width: 2, height: 2 }), true);
  assert.equal(containsRect(DEFAULT_WORLD, { x: 0, y: 0 }, { width: 2, height: 2 }), false);
  assert.deepEqual(clampCenter(DEFAULT_WORLD, { x: -30, y: 50 }, { width: 2, height: 4 }), { x: 1, y: 30 });
  assert.throws(() => clampCenter(DEFAULT_WORLD, { x: 0, y: 0 }, { width: 50, height: 2 }), RangeError);
});
