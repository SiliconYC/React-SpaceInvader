import type {EnemyKind} from '../core/level.ts';

export interface EnemyMotionCues {
  readonly turnTick?:number;
  readonly attackTick?:number;
  readonly damageTick?:number;
}
export interface EnemyVisualPose {
  readonly roll:number; readonly yaw:number; readonly pitch:number; readonly lift:number;
  /** Pure visual per-instance scale accents; do not influence model root, hitbox or RNG. */
  readonly weaponPulse:number; readonly corePulse:number;
}
export const ZERO_ENEMY_POSE:EnemyVisualPose=Object.freeze({
  roll:0,yaw:0,pitch:0,lift:0,weaponPulse:0,corePulse:0,
});
/** Stable FNV hash, independent of Math.random, logic RNG and render order. */
export function enemyPhase(id:string):number {
  let hash=2166136261;
  for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);
  return ((hash>>>0)%4096)/4096*Math.PI*2;
}
const pulse=(tick:number,eventTick:number|undefined,decayFrames:number)=>{
  if(eventTick===undefined||eventTick>tick)return 0;
  return Math.exp(-(tick-eventTick)/decayFrames);
};
/**
 * P4/C2: fixed-tick deterministic acting. Shared formation heading + bounded, per-ID
 * micro timing. Attack/turn/armor cues come ONLY from already emitted rule events.
 * No independent clock, per-frame random variation, translations in XY or extra meshes.
 */
export function enemyVisualPose(kind:EnemyKind,id:string,tick:number,direction:-1|1,
  phase:string,reducedMotion=false,cues:EnemyMotionCues={}):EnemyVisualPose {
  if(reducedMotion||(phase!=='running'&&phase!=='paused')||!Number.isFinite(tick))
    return ZERO_ENEMY_POSE;
  const t=tick/60;
  const local=enemyPhase(id);
  const turn=pulse(tick,cues.turnTick,9);
  const attack=pulse(tick,cues.attackTick,11);
  const hit=pulse(tick,cues.damageTick,9);
  // Units share a coherent slow cadence, but have stable individual lag and response.
  const formationBeat=Math.sin(t*1.02)*.012;
  if(kind==='scout'){
    const flicker=Math.sin(t*3.0+local)*.027;
    return {
      roll:direction*.032+formationBeat+flicker+turn*direction*.085,
      yaw:direction*.019+Math.sin(t*2.4+local*.8)*.036+turn*direction*.045,
      pitch:Math.cos(t*2.3+local)*.019-attack*.058+hit*.029,
      lift:Math.sin(t*2.1+local)*.019,
      weaponPulse:attack*.29,
      corePulse:hit*.12,
    };
  }
  if(kind==='raider'){
    return {
      roll:direction*.073+formationBeat*.55+
        Math.sin(t*1.65+local*.5)*.018+turn*direction*.115,
      yaw:direction*.047+Math.cos(t*1.3+local)*.012+turn*direction*.060,
      pitch:.017+Math.sin(t*1.4+local)*.019-attack*.085+hit*.044,
      lift:Math.sin(t*1.25+local*.7)*.014,
      weaponPulse:attack*.48,
      corePulse:hit*.10,
    };
  }
  // Heavy guardian: suppressed roll, armor recoil and local core energy pulse.
  return {
    roll:direction*.013+Math.sin(t*.66+local)*.007+turn*direction*.012,
    yaw:direction*.012+Math.sin(t*.67+local*.6)*.013,
    pitch:Math.cos(t*.72+local)*.010-hit*.032-attack*.015,
    lift:Math.sin(t*.70+local)*.010,
    weaponPulse:attack*.16,
    corePulse:attack*.22+hit*.40,
  };
}
