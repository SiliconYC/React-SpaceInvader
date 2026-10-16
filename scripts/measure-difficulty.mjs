import {readFileSync} from 'node:fs';
import {parseLevel} from '../src/levels/parse.ts';
import {GameEngine} from '../src/core/engine.ts';

const read=(id)=>JSON.parse(readFileSync(new URL('../public/levels/'+id+'.json',import.meta.url),'utf8'));
function legacy(id){
  const raw=read(id);
  if(id==='first-contact'){
    raw.waves[0].movement.horizontalSpeed=2.4;
    raw.waves[0].movement.descentPerTurn=.9;
    raw.waves[0].attack.shotsPerMinute=10;
  } else{
    raw.waves[0].movement.horizontalSpeed=4.6;
    raw.waves[1].movement.horizontalSpeed=6;
    raw.waves[0].attack.shotsPerMinute=14;
    raw.waves[1].attack.shotsPerMinute=26;
    raw.waves[0].attack.projectileSpeed=9;
    raw.difficulty.speedMultiplier=1.2;
    raw.difficulty.fireRateMultiplier=1.25;
  }
  for(const wave of raw.waves)delete wave.behavior;
  return raw;
}
function simulate(level,seed){
  const game=new GameEngine(seed,level.world,level);
  game.dispatch({type:'START'});game.dispatch({type:'SET_FIRING',active:true});
  const metrics={ticks:0,playerShots:0,enemyShots:0,kills:0,armorHits:0,playerHits:0,waves:0};
  for(let tick=0;tick<4200 && game.snapshot().phase==='running';tick++){
    const state=game.snapshot();
    if(state.enemies.length){
      const sorted=[...state.enemies].sort((a,b)=>
        Math.abs(a.position.x-state.player.position.x)-Math.abs(b.position.x-state.player.position.x) ||
        a.position.y-b.position.y);
      const target=sorted[0];
      const dx=target.position.x-state.player.position.x;
      game.dispatch({type:'SET_MOVEMENT',direction:dx>.12?1:dx<-.12?-1:0});
    }else game.dispatch({type:'SET_MOVEMENT',direction:0});
    game.stepTicks();
    const events=game.drainEvents();
    for(const event of events){
      if(event.type==='shot-fired')metrics.playerShots++;
      if(event.type==='enemy-shot-fired')metrics.enemyShots++;
      if(event.type==='enemy-hit')metrics.kills++;
      if(event.type==='enemy-damaged')metrics.armorHits++;
      if(event.type==='player-hit')metrics.playerHits++;
      if(event.type==='wave-started')metrics.waves++;
    }
    metrics.ticks=game.snapshot().tick;
  }
  const last=game.snapshot();
  return {...metrics,phase:last.phase,score:last.score,lives:last.lives,seconds:+(last.elapsedSeconds).toFixed(1)};
}
const seeds=[1,7,17,47,91,137];
console.log('P2 #23 可重复 AI 追踪射击基线（固定种子 '+seeds.join(',')+'，最多 70 秒）；这是自动策略，不是人类实玩');
for(const id of ['first-contact','crossfire']){
  for(const [version,raw] of [['P1',legacy(id)],['P2',read(id)]]){
    const level=parseLevel(raw);
    const result=seeds.map(seed=>simulate(level,seed));
    const average=k=>+(result.reduce((sum,r)=>sum+r[k],0)/result.length).toFixed(1);
    console.log(JSON.stringify({
      level:id,version,seeds:seeds.length,
      wins:result.filter(r=>r.phase==='won').length,
      losses:result.filter(r=>r.phase==='lost').length,
      unfinished:result.filter(r=>r.phase==='running').length,
      avgSeconds:average('seconds'),avgScore:average('score'),
      avgPlayerShots:average('playerShots'),avgEnemyShots:average('enemyShots'),
      avgPlayerHits:average('playerHits'),avgArmorHits:average('armorHits'),
      avgEnemiesKilled:average('kills'),avgWaves:average('waves'),
    }));
  }
}
