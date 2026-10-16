import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLevel } from '../src/levels/parse.ts';
import { GameEngine } from '../src/core/engine.ts';
import { advanceFormation } from '../src/core/formation.ts';
import { firstWaveEnemies } from '../src/core/level.ts';

const base = JSON.parse(readFileSync(new URL('../public/levels/first-contact.json', import.meta.url), 'utf8'));
const make = (fn = (v: any) => {}) => {
  const raw = structuredClone(base); fn(raw); return parseLevel(raw);
};

test('敌阵确定性地向右碰壁、下降并反向；一直在世界内，间距不变', () => {
  const level = make(v => { v.waves[0].movement.horizontalSpeed = 12; v.waves[0].movement.descentPerTurn = 1.1; });
  const game = new GameEngine(1, level.world, level);
  const initial = game.snapshot().enemies;
  game.dispatch({ type: 'START' });
  let turns = 0;
  for (let i = 0; i < 600; i++) {
    game.stepTicks();
    const { enemies, formationDirection, formationTurns } = game.snapshot();
    turns = formationTurns;
    for (let k = 0; k < enemies.length; k++) {
      const e = enemies[k];
      assert.ok(e.position.x - e.width / 2 >= -1e-8 && e.position.x + e.width / 2 <= level.world.width + 1e-8);
      assert.ok(e.position.y - e.height / 2 >= -1e-8);
      assert.ok(Math.abs((e.position.x - enemies[0].position.x) - (initial[k].position.x - initial[0].position.x)) < 1e-7);
      assert.ok(Math.abs((e.position.y - enemies[0].position.y) - (initial[k].position.y - initial[0].position.y)) < 1e-7);
    }
    assert.ok(formationDirection === -1 || formationDirection === 1);
  }
  assert.ok(turns >= 2);
  assert.ok(game.snapshot().enemies[0].position.y < initial[0].position.y);
});

test('不同 fps、暂停、重置和同种子一致', () => {
  const level = make();
  const a = new GameEngine(7, level.world, level), b = new GameEngine(7, level.world, level);
  a.dispatch({ type: 'START' }); b.dispatch({ type: 'START' });
  for(let i=0;i<180;i++) a.advanceFrame(1/60);
  for(let i=0;i<72;i++) b.advanceFrame(1/24);
  assert.deepEqual(a.snapshot(), b.snapshot());
  a.dispatch({ type: 'PAUSE' }); const paused = a.snapshot();
  a.advanceFrame(4); assert.deepEqual(a.snapshot(), paused);
  a.dispatch({ type: 'RESUME' }); a.stepTicks(33);
  a.dispatch({ type: 'RESET' });
  assert.deepEqual(a.snapshot().enemies, firstWaveEnemies(level));
  assert.equal(a.snapshot().formationTurns, 0);
});

test('速度、方向、移动间隔及下降量完全由 JSON 控制', () => {
  const fast = make(v => { v.waves[0].movement.horizontalSpeed = 9; v.waves[0].movement.moveEveryTicks = 3; v.waves[0].movement.startDirection = -1; });
  const slow = make(v => { v.waves[0].movement.horizontalSpeed = 1; v.waves[0].movement.moveEveryTicks = 1; });
  const a = new GameEngine(3, fast.world, fast), b = new GameEngine(3, slow.world, slow);
  a.dispatch({ type: 'START' }); b.dispatch({ type: 'START' });
  a.stepTicks(2);
  assert.equal(a.snapshot().enemies[0].position.x, firstWaveEnemies(fast)[0].position.x);
  a.stepTicks(1); b.stepTicks(3);
  assert.ok(a.snapshot().enemies[0].position.x < firstWaveEnemies(fast)[0].position.x);
  assert.ok(b.snapshot().enemies[0].position.x > firstWaveEnemies(slow)[0].position.x);
  const noDescent = make(v => { v.waves[0].movement.descentPerTurn = 0; v.waves[0].movement.horizontalSpeed = 40; });
  const zero = new GameEngine(3, noDescent.world, noDescent);zero.dispatch({ type: 'START' });zero.stepTicks(300);
  assert.ok(zero.snapshot().formationTurns>0);
  assert.equal(zero.snapshot().enemies[0].position.y, firstWaveEnemies(noDescent)[0].position.y);
});

test('大移动步长与窄世界反射不越界', () => {
  const level = make(v => {v.waves[0].formation.columns=1;v.waves[0].movement.moveEveryTicks=30;v.waves[0].movement.horizontalSpeed=40;});
  const a = firstWaveEnemies(level);
  let enemies = a, direction: -1|1=1;
  for(let k=0;k<30;k++){
    const next=advanceFormation(enemies,level.world,level.waves[0].movement,1,direction,30);
    enemies=next.enemies; direction=next.direction;
    assert.ok(enemies[0].position.x-enemies[0].width/2 >= -1e-8);
    assert.ok(enemies[0].position.x+enemies[0].width/2 <= level.world.width+1e-8);
  }
});
