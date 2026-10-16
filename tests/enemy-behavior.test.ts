import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLevel } from '../src/levels/parse.ts';
import { firstWaveEnemies } from '../src/core/level.ts';
import { GameEngine } from '../src/core/engine.ts';

const json=(name:string)=>JSON.parse(readFileSync(new URL('../public/levels/'+name+'.json',import.meta.url),'utf8'));
const duel=()=>{
  const raw=json('crossfire');
  const guardian=structuredClone(raw.waves[1]);
  guardian.spawnAtSeconds=0;
  guardian.formation={...guardian.formation,rows:1,columns:1,startX:18,startY:10};
  guardian.movement.horizontalSpeed=0;
  guardian.attack.shotsPerMinute=0;
  raw.waves=[guardian];
  return parseLevel(raw);
};
test('guardian 两次命中才击毁：首次装甲受损不计分，二次击毁只加一次分',()=>{
  const level=duel(), game=new GameEngine(4,level.world,level);
  assert.equal(game.snapshot().enemies[0].hp,2);
  assert.equal(game.snapshot().enemies[0].maxHp,2);
  game.dispatch({type:'START'});
  assert.equal(game.dispatch({type:'FIRE'}).accepted,true);
  game.stepTicks(42);
  assert.equal(game.snapshot().enemies.length,1);
  assert.equal(game.snapshot().enemies[0].hp,1);
  assert.equal(game.snapshot().score,0);
  assert.equal(game.dispatch({type:'FIRE'}).accepted,true);
  game.stepTicks(42);
  assert.equal(game.snapshot().phase,'won');
  assert.equal(game.snapshot().score,30);
  const events=game.drainEvents();
  assert.equal(events.filter(e=>e.type==='enemy-damaged').length,1);
  assert.equal(events.filter(e=>e.type==='enemy-hit').length,1);
  assert.equal(events.filter(e=>e.type==='game-finished').length,1);
  game.dispatch({type:'RESET'});
  assert.equal(game.snapshot().enemies[0].hp,2);
});
test('raider 双列齐射：同一合法发射 tick 两枚不同列子弹，零装甲差异',()=>{
  const raw=json('crossfire');
  raw.waves=[raw.waves[0]];
  const wave=raw.waves[0];
  Object.assign(wave.formation,{rows:1,columns:2,startX:12,startY:14});
  wave.movement.horizontalSpeed=0;
  wave.attack.shotsPerMinute=120;
  wave.attack.projectileSpeed=3;
  const level=parseLevel(raw), game=new GameEngine(99,level.world,level);
  assert.deepEqual(firstWaveEnemies(level).map(e=>e.hp),[1,1]);
  game.dispatch({type:'START'});
  const cadence=Math.round(3600/(120*level.difficulty.fireRateMultiplier));
  game.stepTicks(cadence);
  const shots=game.drainEvents().filter(e=>e.type==='enemy-shot-fired');
  assert.equal(shots.length,2);
  const shooters=shots.map(e=>e.type==='enemy-shot-fired'?e.enemyId:'');
  assert.equal(new Set(shooters).size,2);
  assert.equal(game.snapshot().enemyProjectiles.length,2);
  game.stepTicks(cadence);
  assert.equal(game.snapshot().enemyProjectiles.length,4);
});
test('旧版 v1 JSON 缺省 behavior 按一发一命、单发齐射处理，不更改版本',()=>{
  const raw=json('crossfire');
  for(const wave of raw.waves)delete wave.behavior;
  const level=parseLevel(raw);
  assert.deepEqual(level.waves.map(w=>w.behavior),[
    {armorHits:1,volleySize:1},{armorHits:1,volleySize:1}]);
  assert.equal(firstWaveEnemies(level)[0].hp,1);
});
test('修改 JSON 即更改耐久和齐射；非法数值、部分配置及未知字段拒绝',()=>{
  const raw=json('crossfire');
  for(const behavior of [
    {armorHits:0,volleySize:1},{armorHits:4,volleySize:1},
    {armorHits:1.4,volleySize:1},{armorHits:1,volleySize:0},
    {armorHits:1,volleySize:4},{armorHits:1},{armorHits:1,volleySize:1,unknown:2},
    null,'bad',
  ]){
    const invalid=structuredClone(raw);invalid.waves[1].behavior=behavior;
    assert.throws(()=>parseLevel(invalid),/关卡数据无效/);
  }
  const changed=structuredClone(raw);
  changed.waves[1].behavior.armorHits=3;
  changed.waves[1].behavior.volleySize=2;
  const alt=parseLevel(changed);
  assert.equal(firstWaveEnemies(parseLevel({...changed,waves:[{...changed.waves[1],spawnAtSeconds:0}]}))[0].hp,3);
  assert.equal(alt.waves[1].behavior.volleySize,2);
});
test('装甲与双列齐射在不同帧率与重置后可完全复现',()=>{
  const level=parseLevel(json('crossfire'));
  const run=(fps:number)=>{
    const game=new GameEngine(901,level.world,level);
    game.dispatch({type:'START'});
    game.dispatch({type:'SET_FIRING',active:true});
    for(let t=0;t<fps*3;t++)game.advanceFrame(1/fps);
    const result={state:game.snapshot(),events:game.drainEvents()};
    game.dispatch({type:'RESET'});
    game.dispatch({type:'START'});
    game.dispatch({type:'SET_FIRING',active:true});
    game.stepTicks(180);
    assert.deepEqual(game.snapshot(),result.state);
    return result;
  };
  assert.deepEqual(run(24),run(60));
});
