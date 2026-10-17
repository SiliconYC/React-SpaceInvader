/** P3/B3: purely visual easing. The authoritative game state stays two-dimensional. */
export interface PlayerPose {
  readonly roll: number; readonly yaw: number; readonly pitch: number;
  readonly offsetY: number; readonly offsetZ: number; readonly recoil: number;
}
const REST:PlayerPose=Object.freeze({roll:0,yaw:0,pitch:0,offsetY:0,offsetZ:0,recoil:0});
export class PlayerShipMotion {
  private pose:PlayerPose=REST;
  private lastX:number|null=null;
  private lastTick=0;
  private lastNow:number|null=null;
  private animationTime=0;
  private recoil=0;

  reset():PlayerPose {
    this.pose=REST;this.lastX=null;this.lastTick=0;this.lastNow=null;
    this.animationTime=0;this.recoil=0;
    return this.pose;
  }
  shot(reducedMotion=false):void {if(!reducedMotion)this.recoil=Math.min(1,this.recoil+.7);}
  update(x:number,tick:number,phase:string,now:number,reducedMotion=false):PlayerPose {
    if(reducedMotion || phase==='ready'||phase==='won'||phase==='lost'||tick<this.lastTick)
      return this.reset();
    if(!Number.isFinite(x)||!Number.isFinite(now))return this.reset();
    if(phase==='paused') {
      this.lastNow=now;
      this.lastX=x;
      this.lastTick=tick;
      return this.pose; // do not run independently when the authoritative clock is stopped
    }
    if(this.lastX===null||this.lastNow===null) {
      this.lastX=x;this.lastNow=now;this.lastTick=tick;
      return this.pose;
    }
    const dt=Math.max(0,Math.min(.05,(now-this.lastNow)/1000));
    const dx=x-this.lastX;
    this.lastX=x;this.lastNow=now;this.lastTick=tick;
    // Velocity is inferred from authoritative XY; never fed back into GameEngine.
    const direction=dt>0?Math.max(-1,Math.min(1,dx/(12*dt))):0;
    this.animationTime+=dt;
    this.recoil*=Math.exp(-15*dt);
    const ease=1-Math.exp(-9*dt);
    const basePitch=.035+Math.sin(this.animationTime*1.7)*.014;
    const targetRoll=-direction*.21; // 12 degrees, screen-plane bank
    const targetYaw=direction*.09; // 5 degrees of real 3D yaw
    const targetPitch=basePitch+Math.abs(direction)*.05+this.recoil*.025;
    this.pose={
      roll:this.pose.roll+(targetRoll-this.pose.roll)*ease,
      yaw:this.pose.yaw+(targetYaw-this.pose.yaw)*ease,
      pitch:this.pose.pitch+(targetPitch-this.pose.pitch)*ease,
      offsetY:Math.sin(this.animationTime*2.1)*.027-this.recoil*.025,
      offsetZ:Math.sin(this.animationTime*1.8)*.046,
      recoil:this.recoil,
    };
    return this.pose;
  }
  get current():PlayerPose{return this.pose;}
}
