import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameEngine } from '../src/core/engine.ts';
import { parseLevel } from '../src/levels/parse.ts';
import { SHOT_COOLDOWN_TICKS, sweptHitTime } from '../src/core/combat.ts';

const base = JSON.parse(readFileSync(new URL('../public/levels/first-contact.json', import.meta.url), 'utf8'));
function stage(options: { x?: number; y?: number; rows?: number; columns?: number; speed?: number } = {}) {
  const v = structuredClone(base);
  const f = v.waves[0].formation;
  f.rows = options.rows ?? 1;
  f.columns = options.columns ?? 1;
  f.startX = options.x ?? 18;
  f.startY = options.y ?? 9;
  v.waves[0].movement.horizontalSpeed = options.speed ?? 0;
  return parseLevel(v);
}
test('纯二维扫掠 AABB 命中高速弹道及移动目标，擦边外不命中', () => {
  const a = { x: 0, y: 0 }, b = { x: 0, y: 100 };
  assert.notEqual(sweptHitTime(a, b, { x: 0, y: 50 }, { x: 0, y: 50 }, .5, .5), null);
  assert.equal(sweptHitTime(a, b, { x: 0.501, y: 50 }, { x: 0.501, y: 50 }, .5, .5), null);
  assert.notEqual(sweptHitTime(a, b, { x: 3, y: 50 }, { x: -3, y: 50 }, .5, .5), null);
  assert.equal(sweptHitTime(a, b, { x: 2, y: 50 }, { x: 2, y: 50 }, .5, .5), null);
  assert.equal(sweptHitTime(a, b, { x: 0, y: -9 }, { x: 0, y: -9 }, .5, .5), null);
});

test('发射命令合法校验、冷却、暂停/重置后不再自动射击', () => {
  const level = stage({ x: 10 });
  const game = new GameEngine(2, level.world, level);
  const ready = game.snapshot();
  assert.equal(game.dispatch({ type: 'FIRE' }).accepted, false);
  assert.equal(game.dispatch({ type: 'SET_FIRING', active: true }).accepted, false);
  assert.deepEqual(game.snapshot(), ready);
  game.dispatch({ type: 'START' });
  assert.equal(game.dispatch({ type: 'FIRE' }).accepted, true);
  assert.equal(game.snapshot().projectiles.length, 1);
  assert.equal(game.dispatch({ type: 'FIRE' }).accepted, false);
  game.stepTicks(SHOT_COOLDOWN_TICKS - 1);
  assert.equal(game.dispatch({ type: 'FIRE' }).accepted, false);
  game.stepTicks(1);
  assert.equal(game.dispatch({ type: 'FIRE' }).accepted, true);
  game.dispatch({ type: 'PAUSE' });
  const paused = game.snapshot();
  assert.equal(game.dispatch({ type: 'FIRE' }).accepted, false);
  assert.equal(game.dispatch({ type: 'SET_FIRING', active: true }).accepted, false);
  game.stepTicks(120);
  assert.deepEqual(game.snapshot(), paused);
  game.dispatch({ type: 'RESUME' });
  game.stepTicks(5);
  assert.equal(game.snapshot().projectiles.length, paused.projectiles.length);
  game.dispatch({ type: 'RESET' });
  assert.equal(game.snapshot().score, 0);
  assert.equal(game.snapshot().projectiles.length, 0);
  assert.equal(game.snapshot().nextShotTick, 0);
});

test('准确命中、移除敌机与子弹、计分事件恰好一次', () => {
  const level = stage({ x: 18, y: 9 });
  const game = new GameEngine(6, level.world, level);
  game.dispatch({ type: 'START' });
  game.dispatch({ type: 'FIRE' });
  game.stepTicks(30);
  const state = game.snapshot();
  assert.equal(state.enemies.length, 0);
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.score, 10);
  const hits = game.drainEvents().filter(event => event.type === 'enemy-hit');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].enemyId, 'scout-wave-0-0');
  assert.equal(hits[0].points, 10);
  game.stepTicks(90);
  assert.equal(game.snapshot().score, 10);
  game.dispatch({ type: 'RESET' });
  assert.equal(game.snapshot().enemies.length, 1);
  assert.equal(game.snapshot().score, 0);
});

test('擦边未命中，子弹离开顶部会回收', () => {
  const level = stage({ x: 10, y: 12 });
  const game = new GameEngine(5, level.world, level);
  game.dispatch({ type: 'START' });
  game.dispatch({ type: 'FIRE' });
  game.stepTicks(90);
  assert.equal(game.snapshot().score, 0);
  assert.equal(game.snapshot().enemies.length, 1);
  assert.equal(game.snapshot().projectiles.length, 0);
});

test('同时在途的子弹不能对已销毁的同一敌机重复计分', () => {
  const level = stage({ y: 19 });
  const game = new GameEngine(5, level.world, level);
  game.dispatch({ type: 'START' });
  game.dispatch({ type: 'SET_FIRING', active: true });
  game.stepTicks(15);
  assert.ok(game.snapshot().projectiles.length >= 2);
  game.dispatch({ type: 'SET_FIRING', active: false });
  game.stepTicks(80);
  assert.equal(game.snapshot().score, 10);
  assert.equal(game.snapshot().enemies.length, 0);
  assert.equal(game.drainEvents().filter(e => e.type === 'enemy-hit').length, 1);
});

test('长按自动射击节奏、不同帧率和随机种子重放相同', () => {
  const level = stage({ x: 4, y: 20 });
  const simulate = (fps: number) => {
    const game = new GameEngine(42, level.world, level);
    game.dispatch({ type: 'START' });
    game.dispatch({ type: 'SET_FIRING', active: true });
    for (let i = 0; i < 2 * fps; i++) game.advanceFrame(1 / fps);
    game.dispatch({ type: 'SET_FIRING', active: false });
    return { state: game.snapshot(), events: game.drainEvents() };
  };
  assert.deepEqual(simulate(60), simulate(24));
  assert.equal(simulate(60).events.filter(e => e.type === 'shot-fired').length, 10);
});
