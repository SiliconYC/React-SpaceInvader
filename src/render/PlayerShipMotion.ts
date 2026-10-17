/** P4/C1: one 60 Hz, rule-tick-driven visual director; never affects the XY authority. */
export interface PlayerPose {
  readonly roll:number; readonly yaw:number; readonly pitch:number;
  readonly offsetY:number; readonly offsetZ:number; readonly recoil:number;
}
export type FlightStage='hover'|'launch'|'cruise'|'brake'|'reverse';
const REST:PlayerPose=Object.freeze({roll:0,yaw:0,pitch:0,offsetY:0,offsetZ:0,recoil:0});
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const approach=(previous:number,target:number,rate:number,dt:number)=>
  previous+(target-previous)*(1-Math.exp(-rate*dt));

/** Presentation-only motion. All integration uses GameEngine.tick, never wall time. */
export class PlayerShipMotion {
  private pose:PlayerPose=REST;
  private lastX:number|null=null;
  private lastTick=-1;
  private velocity=0;
  private commandSpeed=0;
  private kick=0;
  private braking=0;
  private counterbank=0;
  private elapsed=0;
  private state:FlightStage='hover';
  private power=.3;

  reset():PlayerPose {
    this.pose=REST;
    this.lastX=null;this.lastTick=-1;this.velocity=0;this.commandSpeed=0;
    this.kick=0;this.braking=0;this.counterbank=0;this.elapsed=0;
    this.state='hover';this.power=.3;
    return this.pose;
  }
  shot(reducedMotion=false):void {
    if(!reducedMotion)this.kick=clamp(this.kick+.58,0,1);
  }
  update(x:number,tick:number,phase:string,_now:number,reducedMotion=false):PlayerPose {
    if(reducedMotion||phase==='ready'||phase==='won'||phase==='lost'||phase==='ended'||
      !Number.isFinite(x)||!Number.isInteger(tick)||tick<this.lastTick)return this.reset();
    if(phase==='paused')return this.pose;
    if(this.lastX===null){
      this.lastX=x;this.lastTick=tick;return this.pose;
    }
    if(tick===this.lastTick)return this.pose;
    // The actual rule motion, not visual velocity, determines all transitions.
    const frames=clamp(tick-this.lastTick,1,3);
    const dt=frames/60;
    const speed=clamp((x-this.lastX)/dt/12,-1,1);
    const oldVelocity=this.velocity;
    const previousCommand=this.commandSpeed;
    this.commandSpeed=speed;
    this.lastX=x;this.lastTick=tick;this.elapsed+=dt;
    const reversing=Math.sign(speed)!==Math.sign(previousCommand)&&
      Math.abs(speed)>.08&&Math.abs(previousCommand)>.08;
    const slowing=Math.abs(speed)<Math.abs(previousCommand)-.18;
    const starting=Math.abs(speed)>Math.abs(previousCommand)+.18;
    this.state=reversing?'reverse':slowing?'brake':starting?'launch':
      Math.abs(speed)>.08?'cruise':'hover';
    // The thrust response never delays movement. It only affects rendering.
    this.velocity=approach(this.velocity,speed,reversing?24:17,dt);
    this.braking=approach(this.braking,slowing?1:0,slowing?22:12,dt);
    this.counterbank=approach(this.counterbank,
      reversing?-Math.sign(oldVelocity):slowing?-Math.sign(oldVelocity)*.65:0,17,dt);
    this.kick*=Math.exp(-19*dt);
    const active=clamp(Math.abs(this.velocity),0,1);
    const idle=1-active;
    const hover=(Math.sin(this.elapsed*1.55)+.26*Math.sin(this.elapsed*2.83+.35));
    const rollTarget=-speed*.18-this.counterbank*.042;
    const yawTarget=speed*.075;
    const pitchTarget=.012+active*.063+this.braking*.035+this.kick*.027;
    this.pose={
      roll:clamp(approach(this.pose.roll,rollTarget,14,dt),-.225,.225),
      yaw:clamp(approach(this.pose.yaw,yawTarget,13,dt),-.085,.085),
      pitch:clamp(approach(this.pose.pitch,pitchTarget,12,dt),0,.14),
      offsetY:clamp(hover*.011*idle-this.kick*.028,-.037,.019),
      offsetZ:clamp(.007*hover*idle+active*.019,-.018,.038),
      recoil:this.kick,
    };
    this.power=clamp(.30+active*.52+this.braking*.11+this.kick*.09,.22,1);
    return this.pose;
  }
  get current():PlayerPose{return this.pose;}
  get stage():FlightStage{return this.state;}
  get thrust():number{return this.power;}
}
