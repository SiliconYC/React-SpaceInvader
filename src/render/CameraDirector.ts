import type {GameEvent, GamePhase, GameSnapshot} from '../core/engine.ts';

export type CameraCue = 'idle'|'opening'|'wave'|'victory'|'defeat';
export interface CameraPose {
  readonly cue: CameraCue;
  readonly progress: number;
  readonly x: number; readonly y: number;
  readonly zoom: number; readonly roll: number;
}

const REST:CameraPose = {cue:'idle',progress:1,x:0,y:0,zoom:1,roll:0};
const DURATIONS = {opening:900,wave:670,victory:950,defeat:760} as const;
type ActiveCue = Exclude<CameraCue,'idle'>;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const ease=(t:number)=>1-(1-t)**3;

/**
 * Presentation-only camera choreography. It never writes to GameEngine, projectile
 * origins, collision boxes or the authoritative fixed-step time. A paused/hidden
 * tab freezes the visual timeline without accumulating wall-clock catch-up.
 */
export class CameraDirector {
  private cue:ActiveCue|null=null;
  private elapsed=0;
  private lastFrame:number|null=null;
  private playerOffsetX=0;
  private current:CameraPose=REST;

  consume(events:readonly GameEvent[],snapshot:Readonly<GameSnapshot>):void {
    for(const event of events){
      if(event.type==='game-reset'||(event.type==='phase-changed'&&event.to==='ended')){
        this.reset();
      }else if(event.type==='phase-changed'&&event.to==='running'&&event.from==='ready'){
        this.start('opening',snapshot);
      }else if(event.type==='wave-started'&&event.wave>1){
        this.start('wave',snapshot);
      }else if(event.type==='game-finished'){
        this.start(event.phase==='won'?'victory':'defeat',snapshot);
      }
    }
  }

  private start(cue:ActiveCue,snapshot:Readonly<GameSnapshot>):void{
    this.cue=cue;this.elapsed=0;this.lastFrame=null;
    this.playerOffsetX=clamp((snapshot.player.position.x-snapshot.world.width/2)*.1,-.45,.45);
    this.current=this.compute(cue,0);
  }

  /** Called once per existing render loop; never requests another animation frame. */
  sample(now:number,phase:GamePhase,visible:boolean,reducedMotion:boolean):CameraPose {
    if(reducedMotion||phase==='ready'||phase==='ended'){
      this.reset();return REST;
    }
    if(!visible||phase==='paused'){
      this.lastFrame=null;return this.current;
    }
    if(!this.cue)return REST;
    if(this.lastFrame!==null){
      this.elapsed+=clamp(now-this.lastFrame,0,100);
    }
    this.lastFrame=now;
    const duration=DURATIONS[this.cue];
    const progress=clamp(this.elapsed/duration,0,1);
    this.current=this.compute(this.cue,progress);
    if(progress>=1){
      if(this.cue==='opening'||this.cue==='wave'){
        this.cue=null;this.lastFrame=null;this.current=REST;
      }else {
        // Win/loss is deliberately held at its settled composition.
        this.lastFrame=null;
      }
    }
    return this.current;
  }

  private compute(cue:ActiveCue,p:number):CameraPose{
    const t=ease(p);
    switch(cue){
      case 'opening':
        return {cue,progress:p,x:-.42*(1-t),y:.28*(1-t),zoom:.935+.065*t,roll:-.005*(1-t)};
      case 'wave':{
        // A short directional accent and return, distinct from the opening dolly.
        const accent=Math.sin(Math.PI*p)**2;
        return {cue,progress:p,x:.29*accent,y:.17*accent,zoom:1+.028*accent,roll:.004*accent};
      }
      case 'victory':
        return {cue,progress:p,x:this.playerOffsetX*t,y:-.72*t,zoom:1+.075*t,roll:0};
      case 'defeat':
        return {cue,progress:p,x:0,y:.27*t,zoom:1-.055*t,roll:-.0035*t};
    }
  }

  reset():void {this.cue=null;this.elapsed=0;this.lastFrame=null;this.current=REST;this.playerOffsetX=0;}
  get stage():CameraCue{return this.current.cue;}
}
