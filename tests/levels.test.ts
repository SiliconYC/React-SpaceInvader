import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseLevel, LevelValidationError } from '../src/levels/parse.ts';
import { firstWaveEnemies } from '../src/core/level.ts';
import { GameEngine } from '../src/core/engine.ts';

const json = JSON.parse(await readFile(new URL('../public/levels/first-contact.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const changed = (edit: (data: any) => void) => { const data = structuredClone(json); edit(data); return data; };

test('仓库示例 JSON 合法；同数据同种子静态编队完全一致', () => {
  const level = parseLevel(json);
  const a = new GameEngine(42, level.world, level);
  const b = new GameEngine(42, level.world, level);
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.equal(a.snapshot().enemies.length, 24);
  assert.equal(a.snapshot().enemies[0].position.x, 6.5);
  assert.equal(a.snapshot().enemies[0].position.y, 19.2);
  assert.ok(Math.abs((a.snapshot().enemies.at(-1)?.position.x ?? 0) - 28.9) < 1e-9);
  assert.equal(a.snapshot().enemies.at(-1)?.position.y, 13.6);
  assert.deepEqual(firstWaveEnemies(level), a.snapshot().enemies);
  assert.equal(Object.isFrozen(a.snapshot().enemies), true);
});
test('只改 JSON 编队可更改敌机数量与位置，不改 TypeScript', () => {
  const variant = parseLevel(changed(d => {
    d.waves[0].formation.columns = 6;
    d.waves[0].formation.startX = 4.5;
  }));
  const game = new GameEngine(7, variant.world, variant);
  assert.equal(game.snapshot().enemies.length, 18);
  assert.equal(game.snapshot().enemies[0].position.x, 4.5);
  assert.equal(game.snapshot().player.position.x, 18);
  game.dispatch({ type: 'START' });
  game.stepTicks(120);
  assert.notDeepEqual(game.snapshot().enemies, firstWaveEnemies(variant)); // #6 敌阵运动
  assert.equal(game.snapshot().enemies.length, 18);
});
test('非法版本、字段、非有限数、超界、敌机类型和时序明确拒绝', () => {
  const cases = [
    changed(d => d.schemaVersion = 2),
    changed(d => delete d.victory),
    changed(d => d.surprise = 'unexpected'),
    changed(d => d.world.width = NaN),
    changed(d => d.waves[0].formation.columns = -1),
    changed(d => d.waves[0].formation.columns = 100),
    changed(d => d.waves[0].formation.startX = 35),
    changed(d => d.waves[0].formation.type = 'mystery'),
    changed(d => d.waves[0].movement.horizontalSpeed = -1),
    changed(d => d.waves[0].attack.projectileSpeed = Infinity),
    changed(d => d.waves[0].spawnAtSeconds = 2),
    changed(d => d.waves[0].formation.spacingX = 0.1),
    changed(d => d.metadata.name = ''),
  ];
  for (const invalid of cases) assert.throws(() => parseLevel(invalid), LevelValidationError);
});
test('未来波次参数合法且静态演示只生成首波，二次重置复现', () => {
  const level = parseLevel(changed(d => {
    d.waves.push({ ...structuredClone(d.waves[0]), id: 'second', spawnAtSeconds: 8 });
    d.waves[1].formation.rows = 1;
  }));
  const game = new GameEngine(10, level.world, level);
  assert.equal(level.waves.length, 2);
  assert.equal(game.snapshot().enemies.length, 24);
  game.dispatch({ type: 'START' });
  game.stepTicks(600);
  assert.equal(game.snapshot().enemies.length, 24);
  assert.notDeepEqual(game.snapshot().enemies, firstWaveEnemies(level));
  game.dispatch({ type: 'RESET' });
  assert.equal(game.snapshot().enemies.length, 24);
  assert.deepEqual(game.snapshot().enemies, firstWaveEnemies(level));
});
