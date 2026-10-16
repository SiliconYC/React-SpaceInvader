import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameEngine, INITIAL_LIVES, DAMAGE_IMMUNITY_TICKS } from '../src/core/engine.ts';
import { parseLevel } from '../src/levels/parse.ts';

const base = JSON.parse(readFileSync(new URL('../public/levels/first-contact.json', import.meta.url), 'utf8'));
function scenario(options: {
  x?: number; y?: number; speed?: number; descent?: number;
  shots?: number; projectileSpeed?: number; fireMultiplier?: number; waves?: number;
} = {}) {
  const v = structuredClone(base);
  v.waves[0].formation.rows = 1;
  v.waves[0].formation.columns = 1;
  v.waves[0].formation.startX = options.x ?? 18;
  v.waves[0].formation.startY = options.y ?? 10;
  v.waves[0].movement.horizontalSpeed = options.speed ?? 0;
  v.waves[0].movement.descentPerTurn = options.descent ?? 0;
  v.waves[0].attack.shotsPerMinute = options.shots ?? 0;
  v.waves[0].attack.projectileSpeed = options.projectileSpeed ?? 30;
  v.difficulty.fireRateMultiplier = options.fireMultiplier ?? 1;
  if (options.waves === 2) {
    const second = structuredClone(v.waves[0]);
    second.id = 'wave-two';
    second.spawnAtSeconds = 30;
    v.waves.push(second);
  }
  return parseLevel(v);
}

test('清除最后一个目标获胜、不可再次开火或移动、重启一切恢复', () => {
  const level = scenario();
  const game = new GameEngine(17, level.world, level);
  game.dispatch({ type: 'START' });
  game.dispatch({ type: 'FIRE' });
  game.stepTicks(50);
  const result = game.snapshot();
  assert.equal(result.phase, 'won');
  assert.equal(result.outcome, 'cleared');
  assert.equal(result.enemies.length, 0);
  assert.equal(result.score, 10);
  assert.equal(result.lives, INITIAL_LIVES);
  assert.equal(result.projectiles.length, 0);
  assert.equal(result.enemyProjectiles.length, 0);
  assert.equal(game.stepTicks(300), 0);
  assert.equal(game.dispatch({ type: 'FIRE' }).accepted, false);
  assert.equal(game.dispatch({ type: 'SET_MOVEMENT', direction: 1 }).accepted, false);
  assert.equal(game.dispatch({ type: 'RESUME' }).accepted, false);
  assert.equal(game.dispatch({ type: 'START' }).accepted, false);
  assert.deepEqual(game.snapshot(), result);
  assert.equal(game.drainEvents().filter(e => e.type === 'game-finished').length, 1);
  game.dispatch({ type: 'RESET' });
  assert.equal(game.snapshot().phase, 'ready');
  assert.equal(game.snapshot().outcome, null);
  assert.equal(game.snapshot().score, 0);
  assert.equal(game.snapshot().enemies.length, 1);
  assert.equal(game.snapshot().lives, INITIAL_LIVES);
  game.dispatch({ type: 'START' });
  assert.equal(game.snapshot().phase, 'running');
});

test('固定 tick 的敌军合法发射、随机选取各列最底排，改 JSON 改射速', () => {
  const a = scenario({ shots: 120, projectileSpeed: 11 });
  const fast = scenario({ shots: 120, fireMultiplier: 2 });
  const game = new GameEngine(23, a.world, a);
  game.dispatch({ type: 'START' });
  game.stepTicks(29);
  assert.equal(game.snapshot().enemyProjectiles.length, 0);
  game.stepTicks();
  assert.equal(game.snapshot().enemyProjectiles.length, 1);
  assert.equal(game.snapshot().nextEnemyShotTick, 60);
  const event = game.drainEvents().find(e => e.type === 'enemy-shot-fired');
  assert.equal(event?.enemyId, 'scout-wave-0-0');
  const speedy = new GameEngine(23, fast.world, fast);
  speedy.dispatch({ type: 'START' }); speedy.stepTicks(15);
  assert.equal(speedy.snapshot().enemyProjectiles.length, 1);
  assert.equal(speedy.snapshot().nextEnemyShotTick, 30);
  const quiet = scenario({ shots: 0 });
  const silent = new GameEngine(23, quiet.world, quiet);
  silent.dispatch({ type: 'START' }); silent.stepTicks(300);
  assert.equal(silent.snapshot().enemyProjectiles.length, 0);
  assert.equal(silent.snapshot().nextEnemyShotTick, null);
});

test('多列编队从最下方可攻击单位确定性选取，不存在无效敌机 ID', () => {
  const v = structuredClone(base);
  v.waves[0].movement.horizontalSpeed = 0;
  v.waves[0].attack.shotsPerMinute = 120;
  v.waves[0].attack.projectileSpeed = 5;
  const level = parseLevel(v);
  const game = new GameEngine(123, level.world, level);
  game.dispatch({ type: 'START' }); game.stepTicks(150);
  const attackers = game.drainEvents().filter(e => e.type === 'enemy-shot-fired');
  assert.ok(attackers.length >= 4);
  for (const attack of attackers) {
    if (attack.type === 'enemy-shot-fired') {
      assert.match(attack.enemyId, /^scout-wave-2-[0-7]$/);
      assert.ok(level.waves[0].formation.columns >= 1);
    }
  }
});

test('三次真实子弹命中耗尽生命并冻结状态，弹药只扣一次', () => {
  const level = scenario({ shots: 240, projectileSpeed: 60 });
  const game = new GameEngine(2, level.world, level);
  game.dispatch({ type: 'START' });
  assert.equal(game.stepTicks(400) < 400, true);
  const result = game.snapshot();
  assert.equal(result.phase, 'lost');
  assert.equal(result.outcome, 'lives-exhausted');
  assert.equal(result.lives, 0);
  assert.equal(result.enemyProjectiles.length, 0);
  const events = game.drainEvents();
  const hits = events.filter(e => e.type === 'player-hit');
  assert.equal(hits.length, INITIAL_LIVES);
  assert.equal(events.filter(e => e.type === 'game-finished').length, 1);
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i].tick - hits[i - 1].tick >= DAMAGE_IMMUNITY_TICKS);
  assert.equal(game.dispatch({ type: 'FIRE' }).accepted, false);
  assert.equal(game.dispatch({ type: 'PAUSE' }).accepted, false);
  game.stepTicks(200);
  assert.deepEqual(game.snapshot(), result);
  game.dispatch({ type: 'RESET' });
  assert.equal(game.snapshot().lives, INITIAL_LIVES);
  assert.equal(game.snapshot().enemyProjectiles.length, 0);
  assert.equal(game.snapshot().nextEnemyShotTick, 15);
});

test('敌机下压触及防线立即判负，无需等待射击', () => {
  const level = scenario({ x: 18, y: 12, speed: 40, descent: 25, shots: 0 });
  const game = new GameEngine(31, level.world, level);
  game.dispatch({ type: 'START' });
  game.stepTicks(100);
  assert.equal(game.snapshot().phase, 'lost');
  assert.equal(game.snapshot().outcome, 'line-breached');
  assert.equal(game.snapshot().lives, INITIAL_LIVES);
  assert.equal(game.drainEvents().filter(e => e.type === 'game-finished').length, 1);
});

test('暂停冻结敌弹和状态；恢复正常运行且不累积隐藏时间', () => {
  const level = scenario({ shots: 240, projectileSpeed: 3 });
  const game = new GameEngine(9, level.world, level);
  game.dispatch({ type: 'START' });
  game.stepTicks(30);
  assert.ok(game.snapshot().enemyProjectiles.length >= 1);
  game.dispatch({ type: 'PAUSE' });
  const paused = game.snapshot();
  assert.equal(game.stepTicks(300), 0);
  assert.equal(game.advanceFrame(5), 0);
  assert.deepEqual(game.snapshot(), paused);
  assert.equal(game.dispatch({ type: 'SET_FIRING', active: true }).accepted, false);
  assert.equal(game.dispatch({ type: 'FIRE' }).accepted, false);
  game.dispatch({ type: 'RESUME' });
  game.stepTicks(1);
  assert.equal(game.snapshot().tick, paused.tick + 1);
});

test('相同种子、命令、24/60Hz 帧率一致，重启重复同一敌弹序列', () => {
  const level = scenario({ x: 4, shots: 120, projectileSpeed: 5 });
  const simulate = (fps: number) => {
    const game = new GameEngine(42, level.world, level);
    game.dispatch({ type: 'START' });
    for (let i = 0; i < fps * 2; i++) game.advanceFrame(1 / fps);
    const record = { state: game.snapshot(), events: game.drainEvents() };
    game.dispatch({ type: 'RESET' });
    game.dispatch({ type: 'START' }); game.stepTicks(120);
    assert.deepEqual(game.snapshot(), record.state);
    return record;
  };
  assert.deepEqual(simulate(24), simulate(60));
});

test('等待后续波次时不提前判胜：多波加载仍属于 #9', () => {
  const level = scenario({ waves: 2 });
  const game = new GameEngine(1, level.world, level);
  game.dispatch({ type: 'START' }); game.dispatch({ type: 'FIRE' });
  game.stepTicks(40);
  assert.equal(game.snapshot().enemies.length, 0);
  assert.equal(game.snapshot().pendingWaves, 1);
  assert.equal(game.snapshot().phase, 'running');
});
