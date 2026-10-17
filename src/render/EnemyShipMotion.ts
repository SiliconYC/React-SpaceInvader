import type {EnemyKind} from '../core/level.ts';

export interface EnemyVisualPose {
  readonly roll:number; readonly yaw:number; readonly pitch:number; readonly lift:number;
}
export const ZERO_ENEMY_POSE:EnemyVisualPose=Object.freeze({roll:0,yaw:0,pitch:0,lift:0});
/** Stable hash, independent of Math.random / engine RNG, seed and instance index. */
export function enemyPhase(id:string):number {
  let hash=2166136261;
  for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);
  return ((hash>>>0)%4096)/4096*Math.PI*2;
}
/** Presentation-only pose: tick is the engine's fixed clock; no per-frame RNG or XY offset. */
export function enemyVisualPose(kind:EnemyKind,id:string,tick:number,direction:-1|1,
  phase:string,reducedMotion=false):EnemyVisualPose {
  if(reducedMotion||(phase!=='running'&&phase!=='paused')||!Number.isFinite(tick))
    return ZERO_ENEMY_POSE;
  const t=tick/60;
  const offset=enemyPhase(id);
  if(kind==='scout') {
    return {
      roll:Math.sin(t*3.4+offset)*.080+direction*.026,
      yaw:Math.sin(t*2.6+offset+.6)*.072,
      pitch:Math.cos(t*3.1+offset)*.044,
      lift:Math.sin(t*3.6+offset)*.043,
    };
  }
  if(kind==='raider') {
    return {
      roll:direction*.095+Math.sin(t*1.8+offset)*.026,
      yaw:direction*.045+Math.cos(t*1.6+offset)*.022,
      pitch:Math.sin(t*1.9+offset)*.035,
      lift:Math.sin(t*1.7+offset)*.028,
    };
  }
  return {
    roll:direction*.018+Math.sin(t*.72+offset)*.014,
    yaw:Math.sin(t*.8+offset)*.042,
    pitch:Math.cos(t*.65+offset)*.022,
    lift:Math.sin(t*.83+offset)*.021,
  };
}
