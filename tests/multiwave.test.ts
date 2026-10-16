import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameEngine } from '../src/core/engine.ts';
import { waveEnemies } from '../src/core/level.ts';
import { parseLevel } from '../src/levels/parse.ts';
import { parseLevelCatalog } from '../src/levels/catalog.ts';

const fixture = (id: string) =>
  JSON.parse(readFileSync(new URL('../public/levels/' + id + '.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../public/levels/index.json', import.meta.url), 'utf8'));
function duel(options: { secondAt?: number; shots?: number } = {}) {
  const raw = fixture('crossfire');
  raw.waves[0].formation = { ...raw.waves[0].formation, rows: 1, columns: 1, startX: 18, startY: 10 };
  raw.waves[1].formation = { ...raw.waves[1].formation, rows: 1, columns: 1, startX: 18, startY: 12 };
  raw.waves[0].movement.horizontalSpeed = 0;
  raw.waves[1].movement.horizontalSpeed = 0;
  raw.waves[0].attack.shotsPerMinute = 0;
  raw.waves[1].attack.shotsPerMinute = options.shots ?? 0;
  raw.waves[1].spawnAtSeconds = options.secondAt ?? 2;
  return parseLevel(raw);
}
test('仓库清单两关独立、版本正确、明显有差异，所有 JSON 可以独立校验', () => {
  const listing = parseLevelCatalog(manifest);
  assert.deepEqual(listing.levels.map(x => x.id), ['first-contact', 'crossfire']);
  const a = parseLevel(fixture('first-contact')), b = parseLevel(fixture('crossfire'));
  assert.equal(a.waves.length, 1);
  assert.equal(b.waves.length, 2);
  assert.notEqual(a.waves[0].formation.type, b.waves[0].formation.type);
  assert.notEqual(a.difficulty.speedMultiplier, b.difficulty.speedMultiplier);
  assert.notEqual(a.waves[0].attack.shotsPerMinute, b.waves[0].attack.shotsPerMinute);
  for (const entry of listing.levels) {
    const level = parseLevel(fixture(entry.id));
    assert.equal(level.id, entry.id);
    assert.equal(level.metadata.name, entry.name);
    assert.equal(level.metadata.description, entry.description);
    assert.ok(waveEnemies(level, 0).length > 0);
  }
});
test('清场后等待 JSON 约束的时刻才生成第二波，不提前胜利；击落后最终获胜', () => {
  const level = duel({ secondAt: 2 });
  const game = new GameEngine(42, level.world, level);
  game.dispatch({ type: 'START' });
  game.dispatch({ type: 'FIRE' });
  game.stepTicks(38);
  assert.equal(game.snapshot().enemies.length, 0);
  assert.equal(game.snapshot().phase, 'running');
  assert.equal(game.snapshot().pendingWaves, 1);
  assert.equal(game.snapshot().waitingForWave, true);
  assert.equal(game.snapshot().currentWave, 1);
  assert.equal(game.snapshot().score, 20); // 第一波 raider
  game.stepTicks(81);
  assert.equal(game.snapshot().tick, 119);
  assert.equal(game.snapshot().enemies.length, 0);
  game.stepTicks();
  assert.equal(game.snapshot().tick, 120);
  assert.equal(game.snapshot().enemies.length, 1);
  assert.equal(game.snapshot().currentWave, 2);
  assert.equal(game.snapshot().pendingWaves, 0);
  assert.equal(game.snapshot().waitingForWave, false);
  assert.equal(game.snapshot().enemies[0].id, 'guardian-assault-0-0');
  assert.deepEqual(game.snapshot().enemies, waveEnemies(level, 1));
  assert.equal(game.snapshot().nextEnemyShotTick, null);
  game.dispatch({ type: 'FIRE' });
  game.stepTicks(48);
  assert.equal(game.snapshot().phase, 'won');
  assert.equal(game.snapshot().score, 50); // 第二波 guardian
  assert.equal(game.drainEvents().filter(e => e.type === 'wave-started').length, 2);
  assert.equal(game.drainEvents().length, 0);
});
test('第 2 波最早时间已过去时，在第 1 波清场当个 tick 立即生成', () => {
  const level = duel({ secondAt: 0.1 });
  const game = new GameEngine(15, level.world, level);
  game.dispatch({ type: 'START' }); game.dispatch({ type: 'FIRE' });
  game.stepTicks(40);
  assert.equal(game.snapshot().currentWave, 2);
  assert.equal(game.snapshot().enemies.length, 1);
  assert.equal(game.snapshot().phase, 'running');
});
test('不同波的速度、方向、弹速和攻击节奏切换后只从数据读入', () => {
  const level = duel({ secondAt: 1, shots: 120 });
  const game = new GameEngine(3, level.world, level);
  game.dispatch({ type: 'START' }); game.dispatch({ type: 'FIRE' });
  game.stepTicks(60);
  assert.equal(game.snapshot().currentWave, 2);
  assert.equal(game.snapshot().formationDirection, level.waves[1].movement.startDirection);
  const interval = Math.round(3600 / (120 * level.difficulty.fireRateMultiplier));
  assert.equal(game.snapshot().nextEnemyShotTick, 60 + interval);
  game.stepTicks(interval);
  assert.ok(game.snapshot().enemyProjectiles.length > 0);
  assert.equal(game.drainEvents().filter(e => e.type === 'enemy-shot-fired').length, 1);
});
test('待生成间隔暂停冻结 tick/弹药，重置恢复第一波/种子/计分/生命', () => {
  const level = duel({ secondAt: 10 });
  const game = new GameEngine(7, level.world, level);
  game.dispatch({ type: 'START' }); game.dispatch({ type: 'FIRE' }); game.stepTicks(38);
  assert.equal(game.snapshot().waitingForWave, true);
  game.dispatch({ type: 'PAUSE' }); const paused = game.snapshot();
  game.advanceFrame(200);
  assert.deepEqual(game.snapshot(), paused);
  game.dispatch({ type: 'RESUME' }); game.stepTicks(1);
  assert.equal(game.snapshot().tick, paused.tick + 1);
  game.dispatch({ type: 'RESET' });
  assert.equal(game.snapshot().phase, 'ready');
  assert.equal(game.snapshot().currentWave, 1);
  assert.equal(game.snapshot().pendingWaves, 1);
  assert.equal(game.snapshot().enemies.length, 1);
  assert.equal(game.snapshot().score, 0);
  assert.equal(game.snapshot().tick, 0);
  assert.equal(game.snapshot().waitingForWave, false);
  game.dispatch({ type: 'START' }); game.dispatch({ type: 'FIRE' }); game.stepTicks(38);
  assert.equal(game.snapshot().score, paused.score);
});
test('种子重放：多波快照/事件在固定步进和不同绘制帧率下一致', () => {
  const level = duel({ secondAt: 1, shots: 20 });
  const simulate = (fps: number) => {
    const game = new GameEngine(765, level.world, level);
    game.dispatch({ type: 'START' }); game.dispatch({ type: 'FIRE' });
    for (let i = 0; i < 3 * fps; i++) game.advanceFrame(1 / fps);
    return { snapshot: game.snapshot(), events: game.drainEvents() };
  };
  assert.deepEqual(simulate(24), simulate(60));
  assert.equal(simulate(24).snapshot.currentWave, 2);
});
test('严格清单验证，拒绝重复标识、路径穿越、未知字段、版本/总数非法', () => {
  const bad = [
    { ...manifest, schemaVersion: 2 },
    { ...manifest, surprise: 1 },
    { ...manifest, levels: [manifest.levels[0]] },
    { ...manifest, levels: [manifest.levels[0], manifest.levels[0]] },
    { ...manifest, levels: [{...manifest.levels[0], id: '../bad'}, manifest.levels[1]] },
    { ...manifest, levels: [{...manifest.levels[0], description: ''}, manifest.levels[1]] },
  ];
  for (const entry of bad) assert.throws(() => parseLevelCatalog(entry), /关卡数据无效/);
  assert.throws(() => waveEnemies(parseLevel(fixture('crossfire')), 99), /波次索引无效/);
  const invalid = fixture('crossfire');
  invalid.waves[1].spawnAtSeconds = invalid.waves[0].spawnAtSeconds;
  assert.throws(() => parseLevel(invalid), /严格递增/);
});
